import { groupPages, getPage, ensurePages, chaptersForPage, chapterStartPage, setPageUpdateListener, CHAPTER_RANGES, TOTAL_PAGES, type MushafPage } from './pages';
import { hints } from './hints.svelte';
import { pageFonts } from './fonts.svelte';
import { player } from './player.svelte';
import { settings } from './settings.svelte';

/** Spread reading order within facing pages. */
export const SPREAD_ORDER: 'ltr' | 'rtl' = 'rtl';

class Reader {
  /** The global printed page number currently in view (1–604). */
  pageNo = $state(1);
  dir = $state(1);
  activeSurahId = $state(1);
  visibleSurahIds = $state<number[]>([1]);
  pageVersion = $state(0);
  scrollRequest = $state(0);
  private navigation = 0;

  get pageIdx() {
    return this.pageNo - 1;
  }
  set pageIdx(i: number) {
    this.pageNo = Math.max(1, Math.min(TOTAL_PAGES, i + 1));
  }

  activeKey = $derived(player.activeTiming ? `${player.activeTiming.verse}-${player.activeTiming.pos}` : '');

  pages = $derived.by(() => {
    this.pageVersion;
    const mushaf = settings.mode === 'reading' && settings.readingStyle === 'arabic';
    if (!mushaf) return groupPages(player.verses, settings.layout);
    return Array.from({ length: TOTAL_PAGES }, (_, i) => getPage(i + 1, settings.layout) ?? {
      page: i + 1, juz: Math.min(30, Math.ceil((i + 1) / 20)), lines: [], hasStart: false
    });
  });

  wordPage = $derived.by(() => {
    const map = new Map<string, number>();
    this.pages.forEach((page, i) => page.lines.forEach((line) => line.cells.forEach((cell) => {
      map.set(`${cell.chapterId ?? player.chapter}:${cell.verse.n}-${cell.word.pos}`, i);
    })));
    return map;
  });

  get page(): MushafPage | undefined {
    return this.pages[this.pageIdx];
  }

  get spreadIdx() {
    return Math.floor((this.pageNo - 1) / 2);
  }

  get spread() {
    return this.spreadAt((this.spreadIdx + 1) * 2);
  }

  spreadAt(k: number) {
    const spreadIdx = k >= 2 ? Math.floor(k / 2) - 1 : 0;
    const firstNo = spreadIdx * 2 + 1;
    const secondNo = firstNo + 1;
    const first = this.pageAt(firstNo);
    const second = secondNo <= TOTAL_PAGES ? this.pageAt(secondNo) : null;
    return SPREAD_ORDER === 'rtl'
      ? { right: first, left: second, rightNo: secondNo, leftNo: firstNo, firstNo, secondNo, spreadIdx }
      : { left: first, right: second, rightNo: secondNo, leftNo: firstNo, firstNo, secondNo, spreadIdx };
  }

  pageAt(pageNo: number): MushafPage | null {
    this.pageVersion;
    return getPage(pageNo, settings.layout);
  }

  hasSpread(k: number) {
    return k >= 2 && k <= TOTAL_PAGES && k % 2 === 0;
  }

  get canBack() {
    return settings.spread ? this.spreadIdx > 0 : this.pageNo > 1;
  }

  get canForward() {
    return settings.spread ? this.spreadIdx < Math.floor((TOTAL_PAGES - 1) / 2) : this.pageNo < TOTAL_PAGES;
  }

  go(delta: number) {
    this.navigation++;
    const next = settings.spread ? this.pageNo + Math.trunc(delta) * 2 : this.pageNo + Math.trunc(delta);
    const target = Math.max(1, Math.min(TOTAL_PAGES, next));
    if (target === this.pageNo) return;
    this.dir = delta > 0 ? 1 : -1;
    this.pageNo = target;
    this.syncSidebar();
    this.preload();
    hints.note('pageTurn');
  }

  show(index: number) {
    const pageNo = this.pages[index]?.page;
    if (pageNo) this.showPage(pageNo);
  }

  showPage(pageNo: number) {
    this.navigation++;
    const target = Math.max(1, Math.min(TOTAL_PAGES, pageNo));
    if (target === this.pageNo) return;
    this.dir = target > this.pageNo ? 1 : -1;
    this.pageNo = target;
    this.syncSidebar();
    this.preload();
  }

  async goToSurah(chapterId: number) {
    const [fallbackPage] = CHAPTER_RANGES[chapterId - 1] ?? [1];
    const navigation = ++this.navigation;
    await ensurePages([fallbackPage], settings.layout).catch(() => []);
    const pageNo = chapterStartPage(chapterId, settings.layout) ?? fallbackPage;
    const [loaded] = await Promise.all([
      ensurePages([pageNo], settings.layout).catch(() => []),
      pageFonts.ensure([pageNo])
    ]);
    if (loaded[0]) await document.fonts.load(`1em ${pageFonts.family(pageNo)}`, '\ue000').catch(() => []);
    if (navigation !== this.navigation) return;
    // Keep the current page visible until the destination's page data and font are ready.
    this.activeSurahId = chapterId;
    if (pageNo !== this.pageNo) this.dir = pageNo > this.pageNo ? 1 : -1;
    this.pageNo = pageNo;
    this.syncSidebar(chapterId);
    this.preload();
    if (settings.flow === 'scroll') this.scrollRequest++;
  }

  syncSidebar(preferred?: number, visible?: number[]) {
    const firstPage = settings.flow === 'page' && settings.spread ? this.spread.firstNo : this.pageNo;
    const pageNos = settings.flow === 'page' && settings.spread ? [firstPage, firstPage + 1] : [firstPage];
    const chapters = visible?.length
      ? [...new Set(visible)]
      : [...new Set(pageNos.flatMap((pageNo) => {
          const page = this.pageAt(pageNo);
          return page?.lines.flatMap((line) => line.cells.map((cell) => cell.chapterId ?? player.chapter)) ?? chaptersForPage(pageNo);
        }))];
    this.visibleSurahIds = chapters;
    if (preferred && chapters.includes(preferred)) this.activeSurahId = preferred;
    else if (!chapters.includes(this.activeSurahId) && chapters[0]) this.activeSurahId = chapters[0];
  }

  scrollToPage(pageNo: number) {
    const target = Math.max(1, Math.min(TOTAL_PAGES, pageNo));
    if (target === this.pageNo) return;
    this.navigation++;
    this.pageNo = target;
    this.syncSidebar();
    this.preload();
  }

  preload() {
    const radius = settings.spread ? 4 : 2;
    const pages = Array.from({ length: radius * 2 + 1 }, (_, i) => this.pageNo + i - radius)
      .filter((page) => page >= 1 && page <= TOTAL_PAGES);
    this.preloadPages(pages);
  }

  preloadSurah(chapterId: number) {
    const [first, last] = CHAPTER_RANGES[chapterId - 1] ?? [];
    if (!first || !last) return;
    this.preloadPages(Array.from({ length: Math.min(3, last - first + 1) }, (_, i) => first + i));
  }

  private preloadPages(pages: number[]) {
    void pageFonts.ensure(pages).then((loaded) =>
      Promise.all(pages.filter((_, i) => loaded[i]).map((page) => document.fonts.load(`1em ${pageFonts.family(page)}`, '\ue000')))
    ).catch(() => {});
    void ensurePages(pages, settings.layout).catch(() => {});
  }
}

export const reader = new Reader();
setPageUpdateListener(() => reader.pageVersion++);
