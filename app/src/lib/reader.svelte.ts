import { groupPages, type MushafPage } from './pages';
import { player } from './player.svelte';
import { settings } from './settings.svelte';

/** Shared state of the paged reader, so keyboard shortcuts and the page view agree. */
class Reader {
  /** index (into `pages`) of the page being shown; in a spread, any page of the spread */
  pageIdx = $state(0);
  /** direction of the last page turn: 1 forward, -1 back (drives the slide animation) */
  dir = $state(1);

  /** "verse-pos" of the word being recited, or '' */
  activeKey = $derived(player.activeTiming ? `${player.activeTiming.verse}-${player.activeTiming.pos}` : '');

  pages = $derived(groupPages(player.verses, settings.layout));
  /** "verse-pos" key of every word to the index of the page it is printed on */
  wordPage = $derived.by(() => {
    const m = new Map<string, number>();
    this.pages.forEach((p, i) => p.lines.forEach((l) => l.cells.forEach((c) => m.set(`${c.verse.n}-${c.word.pos}`, i))));
    return m;
  });
  private byNumber = $derived(new Map(this.pages.map((p, i) => [p.page, i])));

  get page(): MushafPage | undefined {
    return this.pages[Math.min(this.pageIdx, Math.max(0, this.pages.length - 1))];
  }

  /**
   * The two facing pages of a book spread. Odd pages sit on the right, even on the left, as in a
   * printed Mushaf; a side with no page of this surah is left blank.
   */
  get spread(): { right: MushafPage | null; left: MushafPage | null; rightNo: number; leftNo: number } {
    const p = this.page?.page ?? 1;
    const rightNo = p % 2 ? p : p + 1;
    const at = (n: number) => {
      const i = this.byNumber.get(n);
      return i === undefined ? null : this.pages[i];
    };
    return { right: at(rightNo), left: at(rightNo - 1), rightNo, leftNo: rightNo - 1 };
  }

  get canBack() {
    if (!this.pages.length) return false;
    return settings.spread ? this.spread.leftNo > this.pages[0].page : this.pageIdx > 0;
  }
  get canForward() {
    if (!this.pages.length) return false;
    const last = this.pages[this.pages.length - 1].page;
    return settings.spread ? this.spread.rightNo < last : this.pageIdx < this.pages.length - 1;
  }

  go(delta: number) {
    if (!this.pages.length) return;
    if (settings.spread) {
      const target = this.spread.rightNo + 2 * delta;
      const first = this.pages[0].page;
      const last = this.pages[this.pages.length - 1].page;
      if (target < (first | 1) || target - 1 > last) return;
      const i = this.byNumber.get(target) ?? this.byNumber.get(target - 1);
      if (i === undefined) return;
      this.dir = delta > 0 ? 1 : -1;
      this.pageIdx = i;
      return;
    }
    const next = Math.min(Math.max(this.pageIdx + delta, 0), this.pages.length - 1);
    if (next === this.pageIdx) return;
    this.dir = delta > 0 ? 1 : -1;
    this.pageIdx = next;
  }

  show(index: number) {
    if (index === this.pageIdx || index < 0 || index >= this.pages.length) return;
    if (settings.spread && this.spreadContains(index)) return;
    this.dir = index > this.pageIdx ? 1 : -1;
    this.pageIdx = index;
  }

  private spreadContains(index: number) {
    const n = this.pages[index].page;
    const { rightNo } = this.spread;
    return n === rightNo || n === rightNo - 1;
  }
}

export const reader = new Reader();
