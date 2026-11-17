import { groupBook, type MushafPage } from './pages';
import { hints } from './hints.svelte';
import { player } from './player.svelte';
import { settings } from './settings.svelte';
import type { Verse } from './types';

const LAST_SURAH = 114;

/** Shared state of the paged reader, so keyboard shortcuts and the page view agree. */
class Reader {
  /** index (into `pages`) of the page being shown; in a spread, any page of the spread */
  pageIdx = $state(0);
  /** counts page turns made by go()/show(), so the Reader can tell a turn from a chapter change */
  turns = $state(0);
  /** direction of the last page turn: 1 forward, -1 back (drives the slide animation) */
  dir = $state(1);
  /** surah window the book is built from (continuous mode); {0,0} until the reader sets it */
  range = $state({ from: 0, to: 0 });
  /** verses of the neighbouring surahs in `range` (the current surah comes from player.verses) */
  cache = $state.raw(new Map<number, Verse[]>());
  /** surahs currently in view (set by the Reader component) */
  visible = $state<number[]>([]);
  /** surah the reader itself asked the player to load (set by the Reader component) */
  selfNav = $state(0);
  private extending = false;

  /** "chapter-verse-pos" key of the word being recited, or '' */
  activeKey = $derived(
    player.activeTiming ? `${player.chapter}-${player.activeTiming.verse}-${player.activeTiming.pos}` : ''
  );

  /** the pages last built, shown while the next surah's text is on its way (so the book is never emptied under the reader) */
  private shown: MushafPage[] = [];

  pages = $derived.by(() => {
    const cur = player.chapter;
    // player.chapter flips at once on load() while player.verses still holds the old surah: only trust it when it is this one's
    const own = player.versesOf === cur ? player.verses : undefined;
    const pages = this.build(cur, own);
    return pages ?? this.shown;
  });

  /** the book around `cur`, or undefined while its text is not in */
  private build(cur: number, own: Verse[] | undefined): MushafPage[] | undefined {
    if (!own && !this.cache.get(cur)) return undefined;
    if (!settings.continuous) return (this.shown = groupBook([{ chapter: cur, verses: own ?? this.cache.get(cur)! }], settings.layout));
    const { from, to } = this.range;
    const avail = (ch: number): Verse[] | undefined => this.cache.get(ch) ?? (ch === cur ? own : undefined);
    // the contiguous run of surahs around the current one whose text is available
    let lo = cur;
    let hi = cur;
    while (lo - 1 >= from && avail(lo - 1)) lo--;
    while (hi + 1 <= to && avail(hi + 1)) hi++;
    const parts: { chapter: number; verses: Verse[] }[] = [];
    for (let ch = lo; ch <= hi; ch++) parts.push({ chapter: ch, verses: avail(ch) ?? [] });
    return (this.shown = groupBook(parts, settings.layout));
  }

  /** "chapter-verse-pos" key of every word to the index of the page it is printed on */
  wordPage = $derived.by(() => {
    const m = new Map<string, number>();
    this.pages.forEach((p, i) =>
      p.lines.forEach((l) => l.cells.forEach((c) => m.set(`${c.chapter}-${c.verse.n}-${c.word.pos}`, i)))
    );
    return m;
  });
  private byNumber = $derived(new Map(this.pages.map((p, i) => [p.page, i])));

  get page(): MushafPage | undefined {
    return this.pages[Math.min(this.pageIdx, Math.max(0, this.pages.length - 1))];
  }

  /**
   * The two facing pages of a book spread, read right to left. Continuous mode: the odd page is on the
   * right and the next (even) page on its left, so page 1 faces page 2. Legacy: an even page on the right
   * and the next (odd) page on its left, so page 2 faces page 3. A side with no page here is left blank.
   */
  get spread() {
    const p = this.page?.page ?? 1;
    const rightNo = settings.continuous ? (p % 2 ? p : p - 1) : p % 2 ? p - 1 : p;
    return this.spreadAt(rightNo);
  }

  /** The spread whose right-hand page is `rightNo`. */
  spreadAt(rightNo: number): { right: MushafPage | null; left: MushafPage | null; rightNo: number; leftNo: number } {
    const at = (n: number) => {
      const i = this.byNumber.get(n);
      return i === undefined ? null : this.pages[i];
    };
    return { right: at(rightNo), left: at(rightNo + 1), rightNo, leftNo: rightNo + 1 };
  }

  /** Is there anything of this surah on the spread that starts at `rightNo`? */
  hasSpread(rightNo: number): boolean {
    return !!this.pages.length && rightNo <= this.pages[this.pages.length - 1].page && rightNo + 1 >= this.pages[0].page;
  }

  get canBack() {
    if (!this.pages.length) return false;
    if (settings.continuous && this.range.from > 1) return true;
    return settings.spread ? this.spread.rightNo > this.pages[0].page : this.pageIdx > 0;
  }
  get canForward() {
    if (!this.pages.length) return false;
    if (settings.continuous && this.range.to < LAST_SURAH) return true;
    const last = this.pages[this.pages.length - 1].page;
    return settings.spread ? this.spread.leftNo < last : this.pageIdx < this.pages.length - 1;
  }

  /**
   * Make the reader show `chapter`. Continuous: if it is already inside the window nothing changes
   * (returns false); otherwise the window becomes the chapter and its neighbours, and their text loads.
   * Returns true when the window was set.
   */
  follow(chapter: number): boolean {
    if (settings.continuous && chapter >= this.range.from && chapter <= this.range.to) return false;
    const from = settings.continuous ? Math.max(1, chapter - 1) : chapter;
    const to = settings.continuous ? Math.min(LAST_SURAH, chapter + 1) : chapter;
    this.range = { from, to };
    const next = new Map<number, Verse[]>();
    for (const [ch, verses] of this.cache) if (ch >= from && ch <= to) next.set(ch, verses);
    if (chapter === player.versesOf && player.verses.length) next.set(chapter, player.verses);
    this.cache = next;
    // the neighbours load beside the current surah and join the book in one step (offline and not cached: they stay out)
    const missing: number[] = [];
    for (let ch = from; ch <= to; ch++) if (ch !== chapter && !next.has(ch)) missing.push(ch);
    if (missing.length) void this.fetchAround(missing);
    return true;
  }

  private async fetchAround(chs: number[]) {
    const got = await Promise.all(chs.map((ch) => player.textFor(ch).then((verses) => [ch, verses] as const, () => null)));
    const add = got.filter((g): g is readonly [number, Verse[]] => !!g && g[0] >= this.range.from && g[0] <= this.range.to);
    if (add.length) this.cache = new Map([...this.cache, ...add]);
  }

  /**
   * Add the surah before (dir -1) or after (dir 1) the window. Returns the number of pages added before
   * the previous first page; for dir -1 `pageIdx` is moved so it keeps pointing at the same page.
   */
  async extend(dir: 1 | -1): Promise<number> {
    if (!settings.continuous || this.extending) return 0;
    const ch = dir > 0 ? this.range.to + 1 : this.range.from - 1;
    if (ch < 1 || ch > LAST_SURAH) return 0;
    this.extending = true;
    try {
      let verses: Verse[];
      try {
        verses = await player.textFor(ch);
      } catch {
        return 0;
      }
      // the window may have moved while the text loaded
      if ((dir > 0 ? this.range.to + 1 : this.range.from - 1) !== ch) return 0;
      const oldFirst = this.pages[0]?.page ?? 0;
      this.cache = new Map(this.cache).set(ch, verses);
      this.range = dir > 0 ? { from: this.range.from, to: ch } : { from: ch, to: this.range.to };
      if (dir > 0) return 0;
      const added = this.pages.filter((p) => p.page < oldFirst).length;
      this.pageIdx += added;
      return added;
    } finally {
      this.extending = false;
    }
  }

  /** Remember the settled surah's text (the Reader calls this when player.verses changes), so it stays in the book after the player moves on. */
  keep(chapter: number, verses: Verse[]) {
    if (this.cache.get(chapter) !== verses) this.cache = new Map(this.cache).set(chapter, verses);
  }

  /** Reload the window's neighbours (translation, script or layout changed). */
  reset() {
    this.range = { from: 0, to: 0 };
    this.cache = new Map();
    this.follow(player.chapter);
  }

  /** index into `pages` of the page where `chapter` starts, else the first page it is on, else 0 */
  firstPageOf(chapter: number): number {
    const i = this.pages.findIndex((p) => p.starts.some((s) => s.chapter === chapter));
    if (i >= 0) return i;
    const j = this.pages.findIndex((p) => p.chapters.includes(chapter));
    return j >= 0 ? j : 0;
  }

  /** the first surah with words on page `i` */
  chapterOfPage(i: number): number {
    return this.pages[i]?.chapters[0] ?? player.chapter;
  }

  private canGrow(delta: number) {
    return settings.continuous && (delta > 0 ? this.range.to < LAST_SURAH : this.range.from > 1);
  }

  /** after a move: load more of the book when the reader is within 3 pages of either end */
  nearEdge() {
    // while the next surah's text is on its way the pages are the previous surah's: nothing to extend
    if (!settings.continuous || !this.pages.length || player.versesOf !== player.chapter) return;
    if (this.pageIdx <= 3) void this.extend(-1);
    else if (this.pages.length - 1 - this.pageIdx <= 3) void this.extend(1);
  }

  /** move one page (or one spread) if the loaded pages allow it */
  private step(delta: number): boolean {
    if (settings.spread) {
      const target = this.spread.rightNo + 2 * delta;
      const first = this.pages[0].page;
      const last = this.pages[this.pages.length - 1].page;
      if (target > last || target + 1 < first) return false;
      const i = this.byNumber.get(target) ?? this.byNumber.get(target + 1);
      if (i === undefined) return false;
      this.dir = delta > 0 ? 1 : -1;
      this.pageIdx = i;
      this.turns++;
      return true;
    }
    const next = Math.min(Math.max(this.pageIdx + delta, 0), this.pages.length - 1);
    if (next === this.pageIdx) return false;
    this.dir = delta > 0 ? 1 : -1;
    this.pageIdx = next;
    this.turns++;
    return true;
  }

  go(delta: number) {
    if (!this.pages.length) return;
    if (this.step(delta)) {
      hints.note('pageTurn');
      this.nearEdge();
      return;
    }
    // at the end of what is loaded: fetch the next surah, then turn
    if (this.canGrow(delta)) {
      void this.extend(delta > 0 ? 1 : -1).then(() => {
        if (this.step(delta)) {
          hints.note('pageTurn');
          this.nearEdge();
        }
      });
    }
  }

  show(index: number) {
    if (index === this.pageIdx || index < 0 || index >= this.pages.length) return;
    if (settings.spread && this.spreadContains(index)) return;
    this.dir = index > this.pageIdx ? 1 : -1;
    this.pageIdx = index;
    this.turns++;
    this.nearEdge();
  }

  private spreadContains(index: number) {
    const n = this.pages[index].page;
    const { rightNo } = this.spread;
    return n === rightNo || n === rightNo + 1;
  }
}

export const reader = new Reader();
