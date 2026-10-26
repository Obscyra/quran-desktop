import type { Verse, Word } from './types';
import type { PageType } from './settings.svelte';

export interface Cell {
  verse: Verse;
  word: Word;
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
