import { SvelteSet } from 'svelte/reactivity';
import * as offline from './offline';

// quran.com prints each Mushaf page in its own font, where every word is one glyph. That is what
// makes the lines match the printed page exactly. Fonts are fetched once, kept in IndexedDB, and
// work offline afterwards.
const HOST = 'https://verses.quran.foundation/fonts/quran/hafs/v2/woff2';

/** page → size in bytes of the font fetched from the provider after the installer was built */
export const FRESH_FONTS = 'quran.fresh.fonts';
export function freshFonts(): Record<number, number> {
  try {
    return JSON.parse(localStorage.getItem(FRESH_FONTS) ?? '{}');
  } catch {
    return {};
  }
}

const NETWORK_CAP = 6;
const FETCH_TIMEOUT = 20000;
const RETRY_AFTER = 30000;

type Priority = 'high' | 'low';

/** the first few distinct pages of a surah (words and verse-end marks), for a low-priority preload */
export function startPages(verses: { words: { gp: number }[]; endPage: number }[], max = 4): number[] {
  const pages = new Set<number>();
  for (const v of verses) {
    for (const w of v.words) pages.add(w.gp);
    pages.add(v.endPage);
    if (pages.size >= max) break;
  }
  return [...pages];
}

class PageFonts {
  /** pages whose font is loaded; has(p) reads one entry, so only readers of page p re-run */
  private ready = new SvelteSet<number>();
  private pending = new Map<number, Promise<boolean>>();
  /** page → when it last failed; retried only by a later ensure() after RETRY_AFTER */
  private failed = new Map<number, number>();
  /** pages waiting for a network slot, by priority */
  private queue: { high: number[]; low: number[] } = { high: [], low: [] };
  private waiting = new Map<number, () => void>();
  private active = 0;

  has(page: number) {
    return this.ready.has(page);
  }
  /** true once we gave up on a page (offline and never cached): callers fall back to plain text */
  missing(page: number) {
    return this.failed.has(page) && !this.ready.has(page);
  }

  family(page: number) {
    return `QCF${page}`;
  }

  /** high (default): pages being read, ahead of everything queued. low: preloads, at the back. */
  ensure(pages: Iterable<number>, { priority = 'high' }: { priority?: Priority } = {}): Promise<boolean[]> {
    return Promise.all([...new Set(pages)].filter((p) => p > 0).map((p) => this.one(p, priority)));
  }

  private one(page: number, priority: Priority): Promise<boolean> {
    if (this.ready.has(page)) return Promise.resolve(true);
    let p = this.pending.get(page);
    if (p) {
      if (priority === 'high') this.promote(page);
      return p;
    }
    const failedAt = this.failed.get(page);
    if (failedAt !== undefined && Date.now() - failedAt < RETRY_AFTER) return Promise.resolve(false);
    p = this.load(page, priority).finally(() => this.pending.delete(page));
    this.pending.set(page, p);
    return p;
  }

  /** a page already queued for the network moves to the front */
  private promote(page: number) {
    const low = this.queue.low.indexOf(page);
    if (low < 0) return;
    this.queue.low.splice(low, 1);
    this.queue.high.unshift(page);
  }

  private async slot(page: number, priority: Priority) {
    if (this.active >= NETWORK_CAP) {
      await new Promise<void>((resolve) => {
        this.waiting.set(page, resolve);
        if (priority === 'high') this.queue.high.unshift(page);
        else this.queue.low.push(page);
      });
    }
    this.active++;
  }

  private release() {
    this.active--;
    const next = this.queue.high.shift() ?? this.queue.low.shift();
    if (next === undefined) return;
    const go = this.waiting.get(next);
    this.waiting.delete(next);
    go?.();
  }

  private warned = false;

  private async shipped(page: number): Promise<ArrayBuffer | undefined> {
    const buf = await this.fetchShipped(page);
    if (!buf && !this.warned) {
      this.warned = true;
      console.warn(`Shipped page font p${page}.woff2 is missing; falling back to cache/network. Run npm run bundle.`);
    }
    return buf;
  }

  private async fetchShipped(page: number): Promise<ArrayBuffer | undefined> {
    try {
      const res = await fetch(`/fonts/qcf/p${page}.woff2`);
      if (!res.ok) return undefined;
      const buf = await res.arrayBuffer();
      // judged by the file's own signature ("wOF2"), not the content type: macOS serves the file under another type, and a
      // missing file comes back as the app's HTML page
      const sig = new Uint8Array(buf, 0, 4);
      return sig[0] === 0x77 && sig[1] === 0x4f && sig[2] === 0x46 && sig[3] === 0x32 ? buf : undefined;
    } catch {
      return undefined;
    }
  }

  private async load(page: number, priority: Priority): Promise<boolean> {
    try {
      // the installer carries all 604 page fonts; the cache and the network are only for builds without them
      // a font the provider has changed since the installer was built is kept in the cache and read first
      let buf = freshFonts()[page] ? await offline.getFont(page).catch(() => undefined) : undefined;
      if (!buf) buf = await this.shipped(page);
      if (!buf) buf = await offline.getFont(page).catch(() => undefined);
      if (!buf) {
        await this.slot(page, priority);
        try {
          const res = await fetch(`${HOST}/p${page}.woff2`, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
          if (!res.ok) throw new Error(String(res.status));
          buf = await res.arrayBuffer();
        } finally {
          this.release();
        }
        offline.putFont(page, buf).catch(() => {});
      }
      const face = new FontFace(this.family(page), buf);
      await face.load();
      document.fonts.add(face);
      this.ready.add(page);
      this.failed.delete(page);
      return true;
    } catch {
      this.failed.set(page, Date.now());
      return false;
    }
  }
}

export const pageFonts = new PageFonts();
