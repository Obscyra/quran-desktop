import { bundledIndo, bundledVerses, fetchIndoOnline, fetchVersesOnline, BUNDLED_TRANSLATION } from './api';
import { FRESH_FONTS, freshFonts } from './fonts.svelte';
import * as offline from './offline';
import type { Verse } from './types';

const LAST = 'quran.sync.last';
const EVERY = 7 * 24 * 3600 * 1000;
const FONTS = 'https://verses.quran.foundation/fonts/quran/hafs/v2/woff2';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The installer carries the whole Quran, but the provider (Quran.com) sometimes corrects a word or a font. Once a week,
 * a while after the app starts and only when online, this quietly compares the provider's text and page fonts with what
 * the app has and keeps whatever changed. Nothing is shown and nothing is replaced unless the new copy passes the checks.
 * What is kept is read first the next time that surah or page is opened.
 */
class DataSync {
  running = false;

  start() {
    setTimeout(() => this.run().catch(() => {}), 25000);
  }

  private due() {
    try {
      return Date.now() - Number(localStorage.getItem(LAST) ?? 0) > EVERY;
    } catch {
      return false;
    }
  }

  async run() {
    if (this.running || !navigator.onLine || !this.due()) return;
    this.running = true;
    try {
      await this.fonts();
      await this.text();
      localStorage.setItem(LAST, String(Date.now()));
    } finally {
      this.running = false;
    }
  }

  /** A font whose size at the provider is not the size the app has (the installer's, or the last one kept) is fetched again. */
  private async fonts() {
    let sizes: Record<string, number> = {};
    try {
      const res = await fetch('/data/manifest.json');
      if ((res.headers.get('content-type') ?? '').includes('json')) sizes = (await res.json()).fonts ?? {};
    } catch {
      /* a build without bundled data fetches fonts itself */
    }
    if (!Object.keys(sizes).length) return;
    const kept = freshFonts();
    const pages = Array.from({ length: 604 }, (_, i) => i + 1);
    let next = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (next < pages.length) {
          const p = pages[next++];
          try {
            const head = await fetch(`${FONTS}/p${p}.woff2`, { method: 'HEAD' });
            const remote = Number(head.headers.get('content-length'));
            if (!head.ok || !remote || remote === (kept[p] ?? sizes[p])) continue;
            const res = await fetch(`${FONTS}/p${p}.woff2`);
            const buf = await res.arrayBuffer();
            // a real woff2 file of the size announced, nothing else
            if (!res.ok || buf.byteLength !== remote || new TextDecoder().decode(buf.slice(0, 4)) !== 'wOF2') continue;
            await offline.putFont(p, buf);
            kept[p] = remote;
            localStorage.setItem(FRESH_FONTS, JSON.stringify(kept));
          } catch {
            /* the next sweep tries again */
          }
          await sleep(60);
        }
      })
    );
  }

  /** Every verse has words with text and a glyph, and no verse is missing: otherwise the provider's answer is not used. */
  private sound(fresh: Verse[], have: Verse[]) {
    return (
      fresh.length === have.length &&
      fresh.every((v, i) => v.n === have[i].n && v.words.length > 0 && v.words.every((w) => w.text && w.glyph && w.taj))
    );
  }

  private async text() {
    for (let ch = 1; ch <= 114; ch++) {
      if (!navigator.onLine) return;
      try {
        const have = (await offline.getFresh(ch)) ?? (await bundledVerses(ch));
        if (have) {
          const fresh = await fetchVersesOnline(ch, BUNDLED_TRANSLATION);
          if (JSON.stringify(fresh) !== JSON.stringify(have) && this.sound(fresh, have)) await offline.putFresh(ch, fresh);
        }
        const indo = (await offline.getIndo(ch)) ?? (await bundledIndo(ch));
        if (indo) {
          const fresh = await fetchIndoOnline(ch);
          if (Object.keys(fresh).length === Object.keys(indo).length && JSON.stringify(fresh) !== JSON.stringify(indo)) await offline.putIndo(ch, fresh);
        }
      } catch {
        return; // the connection dropped: carry on at the next start
      }
      await sleep(250);
    }
  }
}

export const dataSync = new DataSync();
