import type { Verse, Word } from './types';
import type { PageType } from './settings.svelte';

export interface Cell {
  verse: Verse;
  word: Word;
  /** last word of its verse, so the verse-end marker goes after it */
  last: boolean;
  /** surah the verse belongs to */
  chapter: number;
}

export interface MushafPage {
  page: number;
  juz: number;
  /** printed line number (1 to 15) mapped to the words on it */
  lines: { line: number; cells: Cell[] }[];
  /** true when a surah's first verse starts on this page (same as starts.length > 0) */
  hasStart: boolean;
  /** surahs that have words on this page, ascending */
  chapters: number[];
  /** for each surah whose verse 1 word 1 is on this page: the printed line that word is on */
  starts: { chapter: number; line: number }[];
}

/** Group one surah's words by the Madani mushaf page and line they are printed on. */
export function groupPages(verses: Verse[], layout: PageType = 'madani', chapter: number): MushafPage[] {
  const byPage = new Map<
    number,
    { juz: number; lines: Map<number, Cell[]>; starts: { chapter: number; line: number }[]; chapters: number[] }
  >();
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
      const pg = byPage.get(page) ?? { juz: verse.juz, lines: new Map<number, Cell[]>(), starts: [], chapters: [chapter] };
      const cells = pg.lines.get(at.line) ?? [];
      cells.push({ verse, word, last: i === verse.words.length - 1, chapter });
      pg.lines.set(at.line, cells);
      if (verse.n === 1 && word.pos === 1) pg.starts.push({ chapter, line: at.line });
      byPage.set(page, pg);
    });
  }
  return [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([page, pg]) => ({
      page,
      juz: pg.juz,
      hasStart: pg.starts.length > 0,
      chapters: pg.chapters,
      starts: pg.starts,
      lines: [...pg.lines.entries()].sort((a, b) => a[0] - b[0]).map(([line, cells]) => ({ line, cells }))
    }));
}

/**
 * Group several consecutive surahs as one book: each surah is grouped on its own, then pages with the
 * same page number are merged, so a page where one surah ends and the next begins shows both.
 */
export function groupBook(parts: { chapter: number; verses: Verse[] }[], layout: PageType): MushafPage[] {
  const byPage = new Map<
    number,
    { juz: number; lines: Map<number, Cell[]>; starts: { chapter: number; line: number }[]; chapters: number[] }
  >();
  const ordered = [...parts].sort((a, b) => a.chapter - b.chapter);
  for (const part of ordered) {
    for (const pg of groupPages(part.verses, layout, part.chapter)) {
      let acc = byPage.get(pg.page);
      if (!acc) {
        acc = { juz: pg.juz, lines: new Map<number, Cell[]>(), starts: [], chapters: [] };
        byPage.set(pg.page, acc);
      }
      for (const l of pg.lines) {
        const cells = acc.lines.get(l.line) ?? [];
        cells.push(...l.cells);
        acc.lines.set(l.line, cells);
      }
      acc.starts.push(...pg.starts);
      for (const c of pg.chapters) if (!acc.chapters.includes(c)) acc.chapters.push(c);
    }
  }
  return [...byPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([page, acc]) => ({
      page,
      juz: acc.juz,
      hasStart: acc.starts.length > 0,
      chapters: [...acc.chapters].sort((a, b) => a - b),
      starts: acc.starts,
      lines: [...acc.lines.entries()].sort((a, b) => a[0] - b[0]).map(([line, cells]) => ({ line, cells }))
    }));
}
