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

class PageFonts {
  /** bumps whenever a font finishes loading, so layouts re-measure */
  tick = $state(0);
  private ready = new Set<number>();
  private pending = new Map<number, Promise<boolean>>();
  private failed = new Set<number>();

  has(page: number) {
    this.tick; // reading it makes callers re-run when a font arrives
    return this.ready.has(page);
  }
  /** true once we gave up on a page (offline and never cached): callers fall back to plain text */
  missing(page: number) {
    this.tick;
    return this.failed.has(page);
  }

  family(page: number) {
    return `QCF${page}`;
  }

  ensure(pages: Iterable<number>): Promise<boolean[]> {
    return Promise.all([...new Set(pages)].filter((p) => p > 0).map((p) => this.one(p)));
  }

  private one(page: number): Promise<boolean> {
    if (this.ready.has(page)) return Promise.resolve(true);
    let p = this.pending.get(page);
    if (!p) {
      p = this.load(page).finally(() => this.pending.delete(page));
      this.pending.set(page, p);
    }
    return p;
  }

  private async shipped(page: number): Promise<ArrayBuffer | undefined> {
    try {
      const res = await fetch(`/fonts/qcf/p${page}.woff2`);
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('font')) return undefined;
      return await res.arrayBuffer();
    } catch {
      return undefined;
    }
  }

  private async load(page: number): Promise<boolean> {
    try {
      // the installer carries all 604 page fonts; the cache and the network are only for builds without them
      // a font the provider has changed since the installer was built is kept in the cache and read first
      let buf = freshFonts()[page] ? await offline.getFont(page).catch(() => undefined) : undefined;
      if (!buf) buf = await this.shipped(page);
      if (!buf) buf = await offline.getFont(page).catch(() => undefined);
      if (!buf) {
        const res = await fetch(`${HOST}/p${page}.woff2`);
        if (!res.ok) throw new Error(String(res.status));
        buf = await res.arrayBuffer();
        offline.putFont(page, buf).catch(() => {});
      }
      const face = new FontFace(this.family(page), buf);
      await face.load();
      document.fonts.add(face);
      this.ready.add(page);
      this.failed.delete(page);
      this.tick++;
      return true;
    } catch {
      this.failed.add(page);
      this.tick++;
      return false;
    }
  }
}

export const pageFonts = new PageFonts();
