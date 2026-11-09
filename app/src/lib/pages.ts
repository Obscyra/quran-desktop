import type { Chapter, Verse, Word } from './types';
import type { PageType } from './settings.svelte';
import { settings } from './settings.svelte';
import { fetchIndo, fetchVerses } from './api';
import { wordLanguage } from './languages';
import { translations } from './translations.svelte';
import pageMap from './page-map.json';

export interface Cell {
  verse: Verse;
  word: Word;
  chapterId?: number;
  /** last word of its verse, so the verse-end marker goes after it */
  last: boolean;
}

export interface MushafPage {
  page: number;
  juz: number;
  /** printed line number (1 to 15) mapped to the words on it */
  lines: { line: number; cells: Cell[] }[];
  /** true when the surah's first verse starts on this page */
  hasStart: boolean;
  headerChapter?: Chapter;
  banners?: { chapter: Chapter; bannerRow: number; bsmRow?: number }[];
  top?: number;
}

export const TOTAL_PAGES = 604;

// Generated from Quran.com word page numbers; every verse keeps its first-word page as well as its surah range.
export const CHAPTER_RANGES = pageMap.chapterRanges as [number, number][];

const chapterVerses = new Map<number, Verse[]>();
const chapterLoads = new Map<number, Promise<void>>();
const chapterMeta = new Map<number, Chapter>();
const pageCache = new Map<number, MushafPage>();
let onPageUpdate: (() => void) | undefined;

export function setPageUpdateListener(fn: () => void) {
  onPageUpdate = fn;
}

export function setChaptersMeta(chapters: Chapter[]) {
  chapters.forEach((chapter) => chapterMeta.set(chapter.id, chapter));
  pageCache.clear();
  onPageUpdate?.();
}

export function chaptersForPage(page: number): number[] {
  return CHAPTER_RANGES.flatMap(([start, end], i) => page >= start && page <= end ? [i + 1] : []);
}

export function chapterStartPage(chapter: number, layout: PageType): number | undefined {
  if (layout === 'madani') return pageMap.chapterStarts[chapter - 1];
  const firstWord = chapterVerses.get(chapter)?.find((verse) => verse.n === 1)?.words[0];
  return firstWord?.indo?.page;
}

function buildPage(pageNo: number, layout: PageType): MushafPage | null {
  const chapters = chaptersForPage(pageNo);
  if (!chapters.length) return null;
  const lines = new Map<number, Cell[]>();
  const banners: { chapter: Chapter; bannerRow: number; bsmRow?: number }[] = [];
  let juz = 1;
  let headerChapter: Chapter | undefined;
  for (const id of chapters) {
    const chapter = chapterMeta.get(id);
    for (const verse of chapterVerses.get(id) ?? []) {
      for (let i = 0; i < verse.words.length; i++) {
        const word = verse.words[i];
        const at = layout === 'indopak' && word.indo ? word.indo : word;
        if (at.page !== pageNo) continue;
        headerChapter ??= chapter;
        juz = verse.juz;
        const cells = lines.get(at.line) ?? [];
        cells.push({ verse, word, chapterId: id, last: i === verse.words.length - 1 });
        lines.set(at.line, cells);
        if (verse.n === 1 && word.pos === 1 && chapter) {
          const bannerRow = at.line - (chapter.bismillah_pre ? 2 : 1);
          banners.push({ chapter, bannerRow, bsmRow: chapter.bismillah_pre ? bannerRow + 1 : undefined });
        }
      }
    }
  }
  const sorted = [...lines.entries()].sort((a, b) => a[0] - b[0]);
  if (!sorted.length) return null;
  const first = sorted[0][0];
  const top = Math.min(first, ...banners.map((b) => b.bannerRow), ...banners.map((b) => b.bsmRow ?? first));
  return {
    page: pageNo,
    juz,
    hasStart: banners.length > 0,
    headerChapter,
    banners,
    lines: sorted.map(([line, cells]) => ({ line, cells })),
    top
  };
}

export function getPage(pageNo: number, layout: PageType = 'madani'): MushafPage | null {
  if (pageNo < 1 || pageNo > TOTAL_PAGES) return null;
  const key = layout === 'madani' ? pageNo : -pageNo;
  let page = pageCache.get(key);
  if (!page) {
    page = buildPage(pageNo, layout) ?? undefined;
    if (page) pageCache.set(key, page);
  }
  return page ?? null;
}

export function cacheChapterVerses(chapter: number, verses: Verse[]) {
  chapterVerses.set(chapter, verses);
  const [start, end] = CHAPTER_RANGES[chapter - 1] ?? [1, 0];
  for (let p = start; p <= end; p++) {
    pageCache.delete(p);
    pageCache.delete(-p);
  }
  onPageUpdate?.();
}

export async function ensurePages(pageNumbers: Iterable<number>, layout: PageType = 'madani') {
  const targets = [...new Set(pageNumbers)].filter((page) => page >= 1 && page <= TOTAL_PAGES);
  const needed = new Set<number>();
  for (const page of targets) for (const chapter of chaptersForPage(page)) if (!chapterVerses.has(chapter)) needed.add(chapter);
  await Promise.all([...needed].map((chapter) => {
    let load = chapterLoads.get(chapter);
    if (!load) {
      load = (async () => {
        let verses = await fetchVerses(chapter, settings.translation, wordLanguage(translations.list.find((t) => t.id === settings.translation)?.language));
        if (layout === 'indopak') {
          const indo = await fetchIndo(chapter);
          verses = verses.map((v) => ({ ...v, words: v.words.map((w) => ({ ...w, indo: indo[`${v.n}-${w.pos}`] })) }));
        }
        cacheChapterVerses(chapter, verses);
      })().finally(() => chapterLoads.delete(chapter));
      chapterLoads.set(chapter, load);
    }
    return load;
  }));
  return targets.map((page) => getPage(page, layout));
}

/** Group a surah's words by the Madani mushaf page and line they are printed on. */
export function groupPages(verses: Verse[], layout: PageType = 'madani'): MushafPage[] {
  const byPage = new Map<number, { juz: number; lines: Map<number, Cell[]>; hasStart: boolean }>();
  // The API sometimes tags the first line of a new page with the previous page's number
  // (e.g. 55:17 comes back as page 531, line 1). Reading order is the truth: page numbers never
  // go backwards, and a line number that drops within a page means the next page began.
  let curPage = 0;
  let prevLine = 0;
  for (const verse of verses) {
    verse.words.forEach((word, i) => {
      const at = layout === 'indopak' && word.indo ? word.indo : word;
      let page = Math.max(at.page, curPage);
      if (page === curPage && at.line < prevLine) page = curPage + 1;
      curPage = page;
      prevLine = at.line;
      const pg = byPage.get(page) ?? { juz: verse.juz, lines: new Map<number, Cell[]>(), hasStart: false };
      const cells = pg.lines.get(at.line) ?? [];
      cells.push({ verse, word, last: i === verse.words.length - 1 });
      pg.lines.set(at.line, cells);
      if (verse.n === 1 && word.pos === 1) pg.hasStart = true;
      byPage.set(page, pg);
    });
  }
  return [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([page, pg]) => ({
      page,
      juz: pg.juz,
      hasStart: pg.hasStart,
      lines: [...pg.lines.entries()].sort((a, b) => a[0] - b[0]).map(([line, cells]) => ({ line, cells }))
    }));
}
