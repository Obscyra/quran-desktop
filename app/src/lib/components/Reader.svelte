<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { SvelteSet } from 'svelte/reactivity';
  import { copyVerse, toggleBookmark } from '$lib/actions';
  import { bookmarks } from '$lib/bookmarks.svelte';
  import { pageFonts } from '$lib/fonts.svelte';
  import { hints } from '$lib/hints.svelte';
  import { cancelIdle, whenIdle } from '$lib/platform';
  import { player } from '$lib/player.svelte';
  import { reader } from '$lib/reader.svelte';
  import { settings, type WordMeaning } from '$lib/settings.svelte';
  import { translations } from '$lib/translations.svelte';
  import { ui } from '$lib/ui.svelte';
  import { frameFor } from '$lib/themes';
  import End from './End.svelte';
  import PageSheet from './PageSheet.svelte';
  import TranslationPicker from './TranslationPicker.svelte';
  import TafsirPicker from './TafsirPicker.svelte';
  import { tafsirs } from '$lib/tafsir.svelte';
  import * as offline from '$lib/offline';
  import Skeleton from './Skeleton.svelte';
  import Word from './Word.svelte';

  const reading = $derived(settings.mode === 'reading');
  const mushafMode = $derived(reading && settings.readingStyle === 'arabic');
  const paged = $derived(mushafMode && settings.flow === 'page');
  // the chosen surah's text is not in yet (the book may already hold it when it was scrolled through before)
  const notReady = $derived(!player.error && player.versesOf !== player.chapter && !(mushafMode && reader.wordPage.has(`${player.chapter}-1-1`)));
  const scrolling = $derived(!paged);
  const activeVerse = $derived(player.activeTiming?.verse ?? 0);
  const below = $derived(settings.wordMeaning === 'below' && !reading);
  const lastIdx = $derived(reader.pages.length - 1);
  const selectedTranslationLanguage = $derived(translations.list.find((x) => x.id === settings.translation)?.language ?? 'English');
  const tafsirFallback = $derived(!!settings.tafsirEdition && tafsirs.get(settings.tafsirEdition)?.language_name.toLowerCase() !== selectedTranslationLanguage.toLowerCase());

  let scroller = $state<HTMLElement>();
  let lastUserScroll = 0;
  let tafsirText = $state<Record<string, string>>({});
  let tafsirLoaded = $state<Record<string, boolean>>({});
  // Mushaf-script text is shown only once the fonts of its pages are in: until then a skeleton holds its place
  const glyphPending = (v: { words: { glyph?: string; gp: number }[] }) =>
    settings.script === 'mushaf' && v.words.some((w) => w.glyph && !pageFonts.has(w.gp) && !pageFonts.missing(w.gp));
  let tafsirLoading = $state<Record<string, boolean>>({});
  let tafsirErrors = $state<Record<string, string>>({});
  const tafsirChapterKey = (chapter: number, edition: string) => `${edition}:${chapter}`;
  const tafsirVerseKey = (chapter: number, verse: number, edition: string) => `${edition}:${chapter}:${verse}`;
  const comparableTafsir = (text: string) => text.replace(/\s+/g, ' ').trim();

  function repeatedTafsirFrom(chapter: number, verse: number, edition: string, text: string) {
    const normalized = comparableTafsir(text);
    let previous = verse - 1;
    if (previous < 1 || comparableTafsir(tafsirText[tafsirVerseKey(chapter, previous, edition)] ?? '') !== normalized) return 0;
    while (previous > 1 && comparableTafsir(tafsirText[tafsirVerseKey(chapter, previous - 1, edition)] ?? '') === normalized) previous--;
    return previous;
  }

  async function loadTafsir(chapter: number, edition: string) {
    if (!edition) return;
    const chapterKey = tafsirChapterKey(chapter, edition);
    if (tafsirLoaded[chapterKey] || tafsirLoading[chapterKey]) return;
    tafsirLoading = { ...tafsirLoading, [chapterKey]: true };
    tafsirErrors = { ...tafsirErrors, [chapterKey]: '' };
    const cached = await offline.getTafsir(edition, chapter).catch(() => undefined);
    ui.tafsirBusy = !cached;
    try {
      const data = await tafsirs.chapter(edition, chapter);
      const next = { ...tafsirText };
      for (const ayah of data.ayahs) next[tafsirVerseKey(chapter, ayah.ayah, edition)] = ayah.text;
      // Only the current and recently requested edition/surah pairs need to stay reactive in memory.
      const pairs = [...new Set(Object.keys(next).map((key) => key.split(':').slice(0, 2).join(':')))];
      if (pairs.length > 4) {
        const remove = new Set(pairs.slice(0, pairs.length - 4));
        for (const key of Object.keys(next)) if (remove.has(key.split(':').slice(0, 2).join(':'))) delete next[key];
      }
      tafsirText = next;
      // an evicted surah must be loadable again: drop its loaded flag with its text
      const stillThere = new Set(pairs.filter((p) => Object.keys(next).some((k) => k.startsWith(`${p}:`))));
      tafsirLoaded = { ...Object.fromEntries(Object.entries(tafsirLoaded).filter(([k]) => stillThere.has(k))), [chapterKey]: true };
    } catch (e) {
      tafsirErrors = { ...tafsirErrors, [chapterKey]: e instanceof Error ? e.message : 'Could not load tafsir. Check your connection and try again.' };
      if (!cached) ui.failNetwork('tafsir', () => { void loadTafsir(chapter, edition); });
    } finally {
      ui.tafsirBusy = false;
      const next = { ...tafsirLoading };
      delete next[chapterKey];
      tafsirLoading = next;
    }
  }

  function toggleVerseTafsir(verse: number) {
    const enabled = settings.tafsirFor(player.chapter, verse);
    settings.setTafsirFor(player.chapter, verse, !enabled);
    if (!enabled) void loadTafsir(player.chapter, settings.tafsirEdition);
  }

  function selectTafsirEdition(slug: string) {
    settings.tafsirEdition = slug;
    settings.tafsirAutoFollow = false;
    if (player.verses.some((v) => settings.tafsirFor(player.chapter, v.n))) void loadTafsir(player.chapter, slug);
  }
  function followTranslationTafsir() {
    settings.tafsirAutoFollow = true;
    const edition = tafsirs.chooseDefault(selectedTranslationLanguage)?.slug ?? '';
    if (edition) settings.tafsirEdition = edition;
  }

  // A long surah is put on the page in small batches (a few frames each), so switching to one never freezes the window.
  // (printed pages are not batched: every page is a cheap placeholder until it is near the window, see `near`)
  const FIRST = { pages: 999, flow: 30, verses: 6 } as const;
  const MAXBATCH = { pages: 999, flow: 30, verses: 8 } as const;
  const kind = $derived(mushafMode ? 'pages' : reading ? 'flow' : 'verses');
  const total = $derived(mushafMode ? reader.pages.length : player.verses.length);
  let upto = $state(0);
  // verse by verse has no PageSheet: the verses drawn so far get their page fonts first
  $effect(() => {
    if (settings.script !== 'mushaf' || (settings.mode === 'reading' && settings.readingStyle === 'arabic')) return;
    const pages = new Set<number>();
    for (const v of player.verses.slice(0, upto)) {
      for (const w of v.words) pages.add(w.gp);
      pages.add(v.endPage);
    }
    untrack(() => pageFonts.ensure(pages));
  });
  $effect(() => {
    const k = kind;
    const t = total;
    player.chapter;
    let raf = 0;
    untrack(() => {
      upto = Math.min(t, FIRST[k]);
      let last = performance.now();
      let batch = 1;
      const grow = (now: number) => {
        // the batch grows while frames stay quick and shrinks (or waits a frame) when the machine is busy
        const dt = now - last;
        last = now;
        if (dt > 40) batch = Math.max(1, Math.floor(batch / 2));
        else {
          upto = Math.min(t, upto + batch);
          if (dt < 20) batch = Math.min(MAXBATCH[k], batch + 1);
        }
        if (upto < t) raf = requestAnimationFrame(grow);
      };
      if (upto < t) raf = requestAnimationFrame(grow);
    });
    return () => cancelAnimationFrame(raf);
  });
  // Scroll mode: a surah can be 50 printed pages (thousands of words). Only the pages near the window are built;
  // the others are empty boxes of the same size, so the scrollbar and positions stay exact and scrolling stays light.
  const near = new SvelteSet<number>();
  // the pages on screen right now; the others on hand are only measured when the browser is idle
  const inView = new SvelteSet<number>();
  let jumpPage = $state(-1);
  const playPage = $derived(mushafMode && reader.activeKey ? (reader.wordPage.get(reader.activeKey) ?? -1) : -1);
  const built = (i: number) => near.has(i) || i === jumpPage || (playPage >= 0 && Math.abs(i - playPage) <= 1);
  // Building a page (about 150 words and the measuring of its lines) is the heavy part of scrolling, so it is spread out:
  // a page in view is built at once; pages on the way are built ahead of time, one per frame; and a page is only dropped
  // once it is far away, so scrolling back does not build it again.
  let pageWatch: IntersectionObserver[] = [];
  let pageWatchRoot: Element | null = null;
  const ahead: number[] = [];
  let aheadRaf = 0;
  let lastScroll = 0;
  const gap = (n: number) => Math.min(...[...inView].map((v) => Math.abs(v - n)), 99);
  const flushAhead = () => {
    aheadRaf = 0;
    // the page nearest to the ones on screen first, whichever way the reader is going
    ahead.sort((a, b) => gap(a) - gap(b));
    // far pages wait for the reader to stop; the ones close by are built even while scrolling
    if (ahead.length && Date.now() - lastScroll < 200 && gap(ahead[0]) > 4) {
      aheadRaf = window.setTimeout(flushAhead, 200);
      return;
    }
    const i = ahead.shift();
    if (i !== undefined) near.add(i);
    if (ahead.length) aheadRaf = whenIdle(flushAhead);
  };
  function watchPage(node: HTMLElement) {
    const root = node.closest('.scroll');
    if (!pageWatch.length || pageWatchRoot !== root) {
      pageWatch.forEach((o) => o.disconnect());
      pageWatchRoot = root;
      const idx = (e: IntersectionObserverEntry) => Number((e.target as HTMLElement).dataset.i);
      pageWatch = [
        // in view: now
        new IntersectionObserver((es) => {
          for (const e of es) e.isIntersecting ? inView.add(idx(e)) : inView.delete(idx(e));
          for (const i of inView) near.add(i);
        }, { root }),
        // within about three screens: ahead of time, one page per frame
        new IntersectionObserver((es) => {
          for (const e of es) {
            const i = idx(e);
            if (e.isIntersecting && !near.has(i) && !ahead.includes(i)) ahead.push(i);
          }
          if (ahead.length && !aheadRaf) aheadRaf = whenIdle(flushAhead);
        }, { root, rootMargin: `${3 * innerHeight}px 0px` }),
        // far away: let go
        new IntersectionObserver((es) => {
          const gone = es.filter((e) => !e.isIntersecting).map(idx);
          for (const i of gone) {
            const at = ahead.indexOf(i);
            if (at >= 0) ahead.splice(at, 1);
          }
          for (const i of gone) near.delete(i);
        }, { root, rootMargin: `${6 * innerHeight}px 0px` })
      ];
    }
    pageWatch.forEach((o) => o.observe(node));
    return { destroy: () => pageWatch.forEach((o) => o.unobserve(node)) };
  }
  /** make sure the item at this index is on the page (before scrolling to it) */
  const reveal = (i: number) => {
    if (i >= upto) upto = Math.min(total, i + 8);
  };
  const indexOfVerse = (ch: number, n: number) => (mushafMode ? (reader.wordPage.get(`${ch}-${n}-1`) ?? -1) : player.verses.findIndex((v) => v.n === n));

  /** bring a verse to the middle of the window: its page, then its first word (Mushaf), or its block (the other views) */
  function showVerse(ch: number, verse: number) {
    const idx = indexOfVerse(ch, verse);
    reveal(idx);
    if (mushafMode) {
      // go to the page's box first so the page gets built, then to the word in it
      jumpPage = idx;
      scroller?.querySelector(`.pg[data-i="${idx}"]`)?.scrollIntoView({ block: 'center', behavior: 'instant' });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          document.getElementById(`w-${ch}-${verse}-1`)?.scrollIntoView({ block: 'center', behavior: 'instant' });
          jumpPage = -1;
        })
      );
    } else {
      const id = reading ? `t-${verse}` : `v-${verse}`;
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'instant' }));
    }
  }

  /** take the reader to the start of `ch`: its page (Pages), or its first verse (scrolling) */
  let pendingStart = 0;
  function toStart(ch: number) {
    const known = reader.wordPage.has(`${ch}-1-1`);
    // the text of a surah opened from outside may still be loading: the start is taken again when it arrives
    pendingStart = known ? 0 : ch;
    if (paged) {
      // the book still shows the previous surah until the text is in: the start is taken again then
      if (!known) return;
      reader.pageIdx = reader.firstPageOf(ch);
      void tick().then(() => {
        if (paged && player.chapter === ch) reader.pageIdx = reader.firstPageOf(ch);
      });
      return;
    }
    if (known) void tick().then(() => {
      if (player.chapter === ch) landAt(ch);
    });
  }

  /**
   * Scroll mode: put the start of a surah (its name banner) at the top of the window and keep it there while the book
   * settles (the neighbouring surahs join it, adding height above). It is one jump, hidden behind a short fade, and nothing
   * else (follow, visible-surah tracking) may move the reader or the player until it is done.
   */
  let pin = 0;
  let pinRaf = 0;
  let pinGuard = 0;
  let landedAt = 0;
  function hideForLanding() {
    if (!scroller) return;
    clearTimeout(pinGuard);
    scroller.style.transition = 'none';
    scroller.style.opacity = '0';
    pinGuard = window.setTimeout(() => endPin(), 4000);
  }
  function showAgain() {
    if (scroller && scroller.style.opacity) {
      scroller.style.transition = 'opacity 0.2s ease';
      scroller.style.opacity = '';
    }
  }
  function endPin() {
    cancelAnimationFrame(pinRaf);
    clearTimeout(pinGuard);
    if (pin) jumpPage = -1;
    pin = 0;
    landedAt = Date.now();
    showAgain();
    for (const ev of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.removeEventListener(ev, endPinByUser, true);
  }
  // the reader takes over: their own scrolling ends the landing
  const endPinByUser = () => endPin();
  function landAt(ch: number) {
    if (!scroller) return;
    cancelAnimationFrame(pinRaf);
    pin = ch;
    hideForLanding();
    for (const ev of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(ev, endPinByUser, { capture: true, passive: true });
    showVerse(ch, 1);
    const t0 = performance.now();
    let quiet = t0;
    const step = () => {
      const box = scroller;
      if (pin !== ch || !box || player.chapter !== ch) return endPin();
      const now = performance.now();
      const w = document.getElementById(`w-${ch}-1-1`);
      if (!w) {
        // its page is not built yet (or not even in the DOM): go to the page's box, which builds it
        const idx = indexOfVerse(ch, 1);
        if (idx >= 0) {
          reveal(idx);
          jumpPage = idx;
          const pg = box.querySelector<HTMLElement>(`.pg[data-i="${idx}"]`);
          if (pg) {
            const dy = (pg.getBoundingClientRect().top - box.getBoundingClientRect().top) / (box.getBoundingClientRect().height / box.clientHeight || 1);
            if (Math.abs(dy) > 1) {
              busyUntil = Date.now() + 150;
              box.scrollTo({ top: box.scrollTop + dy, behavior: 'instant' });
              quiet = now;
            }
          }
        }
      } else {
        // the name banner of this surah: the nearest one above its first line
        const row = parseInt((w.closest('.line') as HTMLElement | null)?.style.gridRow ?? '');
        let el: HTMLElement = w;
        for (const b of w.closest('.lines')?.querySelectorAll<HTMLElement>('.banner') ?? []) {
          if (parseInt(b.style.gridRow) <= row) el = b;
        }
        const r = el.getBoundingClientRect();
        const bx = box.getBoundingClientRect();
        const dy = (r.top - bx.top + 2) / (bx.height / box.clientHeight || 1);
        if (Math.abs(dy) > 1) {
          busyUntil = Date.now() + 150;
          box.scrollTo({ top: box.scrollTop + dy, behavior: 'instant' });
          quiet = now;
        }
      }
      const book = reader.range.from ? [...Array(reader.range.to - reader.range.from + 1)].every((_, i) => reader.cache.has(reader.range.from + i) || reader.range.from + i === ch) : true;
      if ((w && book && now - quiet >= 800) || now - t0 > 3500) return endPin();
      if (w && book && now - quiet >= 250) showAgain();
      pinRaf = requestAnimationFrame(step);
    };
    pinRaf = requestAnimationFrame(step);
  }

  // the reader follows the surah: the book is rebuilt around it when it leaves the loaded window. A move the reader made
  // itself (scrolling or turning into the next surah) only follows the book; any other change opens the surah at its start.
  $effect(() => {
    const ch = player.chapter;
    untrack(() => {
      const reset = mushafMode && reader.follow(ch);
      if (ch === reader.selfNav) {
        reader.selfNav = 0;
        return;
      }
      if (!paged && mushafMode) hideForLanding();
      if (reset) {
        near.clear();
        inView.clear();
        jumpPage = -1;
      }
      if (!mushafMode) {
        reader.pageIdx = 0;
        near.clear();
        scroller?.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }
      toStart(ch);
    });
  });
  // the text arrived for a surah that was opened before it was loaded
  $effect(() => {
    const ch = player.chapter;
    if (!pendingStart || player.versesOf !== ch || !player.verses.length) return;
    untrack(() => {
      const want = pendingStart;
      pendingStart = 0;
      if (want === ch) toStart(ch);
    });
  });
  // coming into Pages/Scroll mode, the book is built around the surah (the other views do not need it)
  $effect(() => {
    if (mushafMode) untrack(() => reader.follow(player.chapter));
  });
  // a surah the reader scrolls out of stays in the book
  $effect(() => {
    const v = player.verses;
    const ch = player.versesOf;
    if (mushafMode && v.length) untrack(() => reader.keep(ch, v));
  });
  // the book is rebuilt when what it is made of changes
  let bookKey = '';
  $effect(() => {
    const key = `${settings.translation}|${settings.layout}|${settings.continuous}`;
    untrack(() => {
      if (bookKey && key !== bookKey) reader.reset();
      bookKey = key;
    });
  });
  // the surahs on screen (the Sidebar marks them): one surah in the verse and translation views
  $effect(() => {
    const ch = player.chapter;
    const m = mushafMode;
    untrack(() => {
      if (!m) reader.visible = [ch];
      else if (!paged) requestAnimationFrame(markVisible);
    });
  });
  let seenTurns = 0;
  // the pages on screen: their surahs are the visible ones; a page of another surah takes the player there (not while playing)
  $effect(() => {
    if (!paged) return;
    const shownPages = settings.spread ? [reader.spread.right, reader.spread.left] : [reader.page];
    const first = shownPages.find((p) => !!p);
    if (!first) return;
    const chs = [...new Set(shownPages.flatMap((p) => p?.chapters ?? []))].sort((a, b) => a - b);
    const turned = reader.turns !== seenTurns;
    untrack(() => {
      seenTurns = reader.turns;
      reader.visible = chs;
      reader.nearEdge(); // a page opened at the edge of the loaded book still needs the surah beyond it
      // only a page turn by the reader moves the player; a surah opened from outside is still arriving
      if (turned && settings.continuous && !player.playing && !player.loading && !chs.includes(player.chapter)) {
        const ch = first.chapters[0];
        reader.selfNav = ch;
        void player.load(ch, false);
      }
    });
  });
  $effect(() => { translations.load(); });
  $effect(() => {
    const chapter = player.chapter;
    const language = selectedTranslationLanguage;
    const autoFollow = settings.tafsirAutoFollow;
    const shouldLoad = !reading && player.verses.some((v) => settings.tafsirFor(chapter, v.n));
    if (!shouldLoad && !tafsirs.editions.length) return;
    void (async () => {
      if (shouldLoad) await tafsirs.load();
      if (player.chapter !== chapter || settings.tafsirAutoFollow !== autoFollow || selectedTranslationLanguage !== language) return;
      if (tafsirs.error && !tafsirs.editions.length && shouldLoad) {
        ui.failNetwork('tafsir', () => {
          tafsirs.error = '';
          void tafsirs.load().then(() => {
            if (player.chapter !== chapter) return;
            const edition = settings.tafsirAutoFollow ? tafsirs.chooseDefault(selectedTranslationLanguage)?.slug ?? '' : settings.tafsirEdition;
            if (edition) { if (settings.tafsirAutoFollow) settings.tafsirEdition = edition; void loadTafsir(chapter, edition); }
          });
        });
        return;
      }
      const edition = autoFollow ? tafsirs.chooseDefault(language)?.slug ?? '' : settings.tafsirEdition;
      if (autoFollow && edition && settings.tafsirEdition !== edition) settings.tafsirEdition = edition;
      if (shouldLoad && edition) await loadTafsir(chapter, edition);
    })();
  });

  // the page turns when the recitation does
  $effect(() => {
    if (!paged || !reader.activeKey) return;
    const i = reader.wordPage.get(reader.activeKey);
    // untracked: browsing to another page yourself must not re-trigger this and snap you back
    if (i !== undefined) untrack(() => reader.show(i));
  });

  // remember where the reader is, so the app reopens there
  $effect(() => {
    if (!paged) return;
    const cell = reader.page?.lines[0]?.cells[0];
    if (cell && cell.chapter === player.chapter && cell.verse.n) player.remember(cell.verse.n);
  });

  // bookmark, search result or reopen: take the reader to a verse of the surah that is open
  $effect(() => {
    const j = player.jump;
    if (!j || !player.verses.length) return;
    untrack(() => {
      if (paged) {
        const i = reader.wordPage.get(`${player.chapter}-${j.verse}-1`);
        if (i !== undefined) reader.show(i);
      } else showVerse(player.chapter, j.verse);
      if (j.mark) markVerse(j.verse);
      player.jump = null;
    });
  });

  // a verse reached by search, bookmark or a link is outlined for a few seconds, so the eye finds it
  let markTimer = 0;
  function markVerse(verse: number) {
    clearTimeout(markTimer);
    ui.target = verse;
    markTimer = window.setTimeout(() => (ui.target = 0), 4000);
  }

  /**
   * Bring the recited verse to the middle of the window. A verse that fits is centred whole; one taller than the
   * window is followed line by line (the word being said stays in the middle band). `force` re-centres even if the
   * verse is already on screen.
   */
  /** screen position of the recited verse (all its words, or its block) and of the scroller */
  function playingBounds() {
    if (!scroller || !activeVerse) return null;
    const box = scroller.getBoundingClientRect();
    // the interface may be zoomed: scrollTop is in the scroller's own units, rects are on screen
    const k = box.height / scroller.clientHeight || 1;
    let top = Infinity;
    let bottom = -Infinity;
    const words = mushafMode || !reading ? scroller.querySelectorAll<HTMLElement>(`[id^="w-${player.chapter}-${activeVerse}-"]`) : [];
    for (const el of words) {
      const r = el.getBoundingClientRect();
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    }
    if (top === Infinity) {
      const el = mushafMode ? scroller.querySelector(`.pg[data-i="${playPage}"]`) : document.getElementById(reading ? `t-${activeVerse}` : `v-${activeVerse}`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      top = r.top;
      bottom = r.bottom;
    }
    return { box, k, top, bottom };
  }

  // unlocked: an arrow appears in the corner when the recited verse is out of sight
  let away = $state<'up' | 'down' | null>(null);
  let awayRaf = 0;
  function checkAway() {
    cancelAnimationFrame(awayRaf);
    awayRaf = requestAnimationFrame(() => {
      const b = !paged && scroller && activeVerse ? playingBounds() : null;
      away = !b ? null : b.bottom < b.box.top ? 'up' : b.top > b.box.bottom ? 'down' : null;
    });
  }
  $effect(() => {
    activeVerse;
    paged;
    reader.activeKey;
    untrack(checkAway);
  });
  function backToPlaying() {
    hints.note('backArrow');
    centerPlaying(true);
  }

  let busyUntil = 0;
  function centerPlaying(force: boolean) {
    if (!scroller || !activeVerse || pin) return;
    untrack(() => reveal(indexOfVerse(player.chapter, activeVerse)));
    const b = playingBounds();
    if (!b) return;
    const { box, k, top, bottom } = b;
    const pad = 24 * k;
    const view = box.height - pad * 2;
    let want: number; // the screen y that should end up in the middle
    if (bottom - top <= view) {
      want = (top + bottom) / 2;
      if (!force && top >= box.top + pad * 0.5 && bottom <= box.bottom - pad * 0.5 && Math.abs(want - (box.top + box.height / 2)) < box.height * 0.2) return;
    } else {
      const w = document.getElementById(`w-${reader.activeKey}`)?.getBoundingClientRect();
      if (!w) return;
      want = (w.top + w.bottom) / 2;
      const rel = (want - box.top) / box.height;
      if (!force && rel > 0.3 && rel < 0.7) return;
    }
    const dy = (want - (box.top + box.height / 2)) / k;
    if (Math.abs(dy) < 2) return;
    busyUntil = Date.now() + 900;
    scroller.scrollTo({ top: scroller.scrollTop + dy, behavior: 'smooth' });
  }

  // keep the recited verse in view, but never fight a reader who is scrolling (unless locked on it)
  $effect(() => {
    if (paged || !activeVerse || !scroller) return;
    reader.activeKey;
    if (settings.follow === 'lock') untrack(() => centerPlaying(false));
    else if (settings.follow === 'follow' && Date.now() - lastUserScroll >= 2500) untrack(() => centerPlaying(false));
  });

  // locked: once the reader lets go, the view returns to the playing verse
  let snapTimer = 0;
  let pressing = false;
  function moved() {
    lastUserScroll = Date.now();
    if (settings.follow !== 'lock') return;
    clearTimeout(snapTimer);
    snapTimer = window.setTimeout(function back() {
      if (pressing) return void (snapTimer = window.setTimeout(back, 300));
      centerPlaying(true);
    }, 650);
  }
  // in the scrolling views, the verse at the top of the window is where the app reopens
  let savePos = 0;
  function saveScrollPlace() {
    const box = scroller;
    if (!box || paged) return;
    const top = box.getBoundingClientRect().top + 8;
    const sel = mushafMode ? '[id^="w-"][id$="-1"]' : reading ? '[id^="t-"]' : '[id^="v-"]';
    for (const el of box.querySelectorAll<HTMLElement>(sel)) {
      if (el.getBoundingClientRect().bottom > top) {
        // Mushaf ids are w-<chapter>-<verse>-<pos>; the other views are t-<verse> and v-<verse>
        const parts = el.id.split('-');
        const ch = mushafMode ? Number(parts[1]) : player.chapter;
        const n = Number(mushafMode ? parts[2] : parts[1]);
        if (n && ch === player.chapter) player.remember(n);
        return;
      }
    }
  }

  // The book grows at its ends while the reader scrolls towards them: the surah before the window is added above the
  // reader, and the place on screen is kept by moving the scroll by the height that was added.
  let growingUp = false;
  let growingDown = false;
  function edges() {
    if (!mushafMode || paged || !settings.continuous || !inView.size || pin) return;
    const seen = [...inView];
    if (Math.min(...seen) <= 1 && !growingUp) void growUp();
    if (Math.max(...seen) >= lastIdx - 1 && !growingDown) void growDown();
  }
  async function growUp() {
    const box = scroller;
    if (!box) return;
    growingUp = true;
    try {
      const before = box.scrollHeight;
      const added = await reader.extend(-1);
      if (added <= 0) return;
      const [n, v] = [[...near], [...inView]];
      near.clear();
      inView.clear();
      n.forEach((i) => near.add(i + added));
      v.forEach((i) => inView.add(i + added));
      if (jumpPage >= 0) jumpPage += added;
      await tick();
      box.scrollTo({ top: box.scrollTop + box.scrollHeight - before, behavior: 'instant' });
    } finally {
      growingUp = false;
    }
  }
  async function growDown() {
    growingDown = true;
    try {
      await reader.extend(1);
    } finally {
      growingDown = false;
    }
  }

  /** the page at the middle of the window, and the surah of the first word on its top edge */
  function here() {
    if (!scroller || paged || !mushafMode) return null;
    const box = scroller.getBoundingClientRect();
    const mid = box.top + box.height / 2;
    let el: HTMLElement | null = null;
    for (const b of scroller.querySelectorAll<HTMLElement>('.pg[data-i]')) {
      if (b.getBoundingClientRect().bottom >= mid) {
        el = b;
        break;
      }
    }
    const page = el ? reader.pages[Number(el.dataset.i)] : undefined;
    if (!el || !page) return null;
    const top = box.top + 8;
    let ch = page.chapters[0] ?? 0;
    for (const w of el.querySelectorAll<HTMLElement>('[id^="w-"]')) {
      if (w.getBoundingClientRect().bottom > top) {
        ch = Number(w.id.split('-')[1]);
        break;
      }
    }
    return { chapters: page.chapters, ch };
  }
  function markVisible() {
    const h = here();
    if (h) reader.visible = h.chapters;
  }
  // once the scrolling stops, the surah on screen is the one the player is on (unless it is playing)
  function settle() {
    // not while a surah is being landed on, and only after the reader has moved the book themselves
    if (player.loading || pin || lastUserScroll <= landedAt) return;
    const h = here();
    if (!h) return;
    reader.visible = h.chapters;
    if (settings.continuous && !player.playing && h.ch && h.ch !== player.chapter) {
      reader.selfNav = h.ch;
      void player.load(h.ch, false);
    }
  }

  let edgeFrame = 0;
  let settleTimer = 0;
  const onscroll = () => {
    lastScroll = Date.now();
    checkAway();
    if (Date.now() > busyUntil) moved();
    clearTimeout(savePos);
    savePos = window.setTimeout(saveScrollPlace, 500);
    if (!edgeFrame) edgeFrame = requestAnimationFrame(() => {
      edgeFrame = 0;
      edges();
    });
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, 250);
  };
  $effect(() => {
    if (settings.follow === 'lock' && !paged && activeVerse) untrack(() => centerPlaying(true));
  });

  // wheel / trackpad turns pages, one per gesture
  let lastTurn = 0;
  function wheel(e: WheelEvent) {
    if (!paged || Math.abs(e.deltaY) < 12) return;
    // a page bigger than the window scrolls first; the turn comes once its edge is reached
    const v = view;
    if (v && v.scrollHeight > v.clientHeight + 2) {
      const atEnd = e.deltaY > 0 ? v.scrollTop + v.clientHeight >= v.scrollHeight - 2 : v.scrollTop <= 1;
      if (!atEnd) return;
    }
    e.preventDefault();
    const now = Date.now();
    if (now - lastTurn < 520) return;
    lastTurn = now;
    reader.go(e.deltaY > 0 ? 1 : -1);
  }
  /** the Arabic text size as a percentage of the default, for the verse view's zoom buttons */
  const sizePct = $derived(Math.round((settings.size / 56) * 100));
  const zoomPage = (d: number) => (hints.note('zoom'), settings.pageZoom = Math.min(3, Math.max(0.5, Math.round((settings.pageZoom + d) * 10) / 10)));
  const fitPage = (f: 'fit' | 'fill') => {
    settings.pageFit = f;
    settings.pageZoom = 1;
  };
  let touchX = 0;
  const touchStart = (e: TouchEvent) => (touchX = e.touches[0].clientX);
  function touchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 60) reader.go(dx > 0 ? 1 : -1); // swipe right = forward (right to left reading)
  }

  // The page being read and its neighbours stay on the page (the neighbours hidden), so a turn only moves and
  // fades pages that are already laid out. Building two new pages at the moment of the turn is what made it stutter.
  // per spread: whether each facing sheet has its font and is fitted; the spread appears only when both are
  let settledL = $state<Record<number, boolean>>({});
  let settledR = $state<Record<number, boolean>>({});
  const step = $derived(settings.spread ? 2 : 1);
  const curKey = $derived(settings.spread ? reader.spread.rightNo : reader.pageIdx);
  const validKey = (k: number) => (settings.spread ? reader.hasSpread(k) : k >= 0 && k < reader.pages.length);
  let kept = $state<number[]>([]);
  let keptFor = '';
  // While the room around the pages is changing (list, player or window), the waiting pages are left out of the
  // layout; once things settle they are laid out again, off-screen, ready for the next turn.
  let waitingReady = $state(false);
  let resizing = 0;
  $effect(() => {
    shape();
    waitingReady = false;
    let idle = 0;
    const t = setTimeout(() => (idle = whenIdle(() => (waitingReady = true))), 700);
    return () => {
      clearTimeout(t);
      cancelIdle(idle);
    };
  });
  function windowResized() {
    waitingReady = false;
    clearTimeout(resizing);
    resizing = window.setTimeout(() => whenIdle(() => (waitingReady = true)), 700);
  }
  $effect(() => {
    const key = curKey;
    const st = step;
    const id = `${settings.spread}:${reader.pages.length}:${player.chapter}`;
    untrack(() => {
      // a different surah or layout starts afresh; otherwise the page just left stays until it has faded
      const keep = id === keptFor ? kept.filter((k) => k !== key && Math.abs(k - key) <= st) : [];
      keptFor = id;
      kept = [key, ...keep];
    });
    const t = setTimeout(() => {
      kept = [...new Set([...kept, key - st, key + st].filter(validKey))];
    }, 450);
    return () => clearTimeout(t);
  });

  $effect(() => {
    curKey;
    untrack(() => view?.scrollTo({ top: 0 }));
  });

  // When the room around the page changes (the list or the player opening), the page glides to its new size
  // instead of jumping: it is moved back to where it was and eased into place with transforms only.
  let stage = $state<HTMLElement>();
  let view = $state<HTMLElement>();
  let before: DOMRect | null = null;
  const shape = () => `${settings.sidebar}${ui.settingsOpen}${ui.listening}${settings.playerBar}`;
  const currentBook = () => {
    return stage?.querySelector<HTMLElement>('.book.cur') ?? null;
  };
  $effect.pre(() => {
    shape();
    untrack(() => (before = currentBook()?.getBoundingClientRect() ?? null));
  });
  $effect(() => {
    shape();
    untrack(() => {
      const from = before;
      before = null;
      const book = currentBook();
      // a page that was hidden (Settings was open) has no size to glide from
      if (!from?.width || !from.height || !book || ui.settingsOpen) return;
      const to = book.getBoundingClientRect();
      if (!to.width || !to.height) return;
      const z = settings.uiScale;
      const dx = (from.left - to.left) / z;
      const dy = (from.top - to.top) / z;
      const sx = from.width / to.width;
      const sy = from.height / to.height;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
      book.animate(
        [{ transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transformOrigin: 'top left', transform: 'none' }],
        { duration: 400, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    });
  });

  const MEANINGS: { id: WordMeaning; name: string }[] = [
    { id: 'off', name: 'Off' },
    { id: 'hover', name: 'Hover' },
    { id: 'below', name: 'Below' }
  ];
  function setTranslation(id: number) {
    settings.translation = id;
    // picking a translation while meanings are switched off means the reader wants to see it
    if (id && settings.wordMeaning === 'off') settings.wordMeaning = 'hover';
    player.refreshText();
  }
  const surahName = $derived(settings.arabicNames ? player.current?.name_arabic : player.current?.name_simple);
</script>

<svelte:window onresize={windowResized} onpointerup={() => (pressing = false)} />

<div
  class="reader"
  style:--ar-size="{settings.size}px"
  style:--ar-lh={settings.spacing}
  style:--tr-size="{settings.translationSize}px"
>
  <!-- ───────── controls for the way you are reading ───────── -->
  <div class="sub">
    {#if reading}
      <div class="seg" role="radiogroup" aria-label="Reading style">
        <button role="radio" aria-checked={settings.readingStyle === 'arabic'} onclick={() => (settings.readingStyle = 'arabic')}>Arabic</button>
        <button role="radio" aria-checked={settings.readingStyle === 'translation'} onclick={() => (settings.readingStyle = 'translation')}>Translation</button>
      </div>
      {#if mushafMode}
        <div class="seg" role="radiogroup" aria-label="Page flow">
          <button role="radio" aria-checked={settings.flow === 'page'} onclick={() => (settings.flow = 'page')}>Pages</button>
          <button role="radio" aria-checked={settings.flow === 'scroll'} onclick={() => (settings.flow = 'scroll')}>Scroll</button>
        </div>
        <div class="size" role="group" aria-label="Page size">
          <button class="icon" aria-label="Zoom out" title={`Zoom out · ${Math.round(settings.pageZoom * 100)}%`} disabled={settings.pageZoom <= 0.5} onclick={() => zoomPage(-0.1)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /><line x1="8" x2="14" y1="11" y2="11" /></svg>
          </button>
          <span class="pct" aria-live="polite" title="Page zoom: {Math.round(settings.pageZoom * 100)}%">{Math.round(settings.pageZoom * 100)}%</span>
          <button class="icon" aria-label="Zoom in" title={`Zoom in · ${Math.round(settings.pageZoom * 100)}%`} disabled={settings.pageZoom >= 3} onclick={() => zoomPage(0.1)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /><line x1="11" x2="11" y1="8" y2="14" /><line x1="8" x2="14" y1="11" y2="11" /></svg>
          </button>
        </div>
        <div class="seg" role="radiogroup" aria-label="Page fit">
          <button role="radio" aria-checked={settings.pageFit === 'fit'} title="Show the whole page" onclick={() => fitPage('fit')}>Fit</button>
          <button role="radio" aria-checked={settings.pageFit === 'fill'} title="Fill the width of the window" onclick={() => fitPage('fill')}>Fill</button>
        </div>
        {#if settings.flow === 'page'}
          <button class="icon" class:on={settings.spread} aria-pressed={settings.spread} aria-label="Two-page spread (T)" title="Two-page spread (T)" onclick={() => (settings.spread = !settings.spread)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>
          </button>
        {/if}
      {:else}
        <label class="pick"><span>Translation</span><TranslationPicker compact onpick={setTranslation} /></label>
      {/if}
    {:else}
      <label class="pick"><span>Translation</span><TranslationPicker compact onpick={setTranslation} /></label>
      <label class="pick"><span>Tafsir</span><TafsirPicker compact onpick={selectTafsirEdition} onauto={followTranslationTafsir} /></label>
      {#if tafsirFallback}<small class="tafsir-note">Using {tafsirs.get(settings.tafsirEdition)?.language_name} tafsir</small>{/if}
      <div class="seg" role="radiogroup" aria-label="Word meanings">
        {#each MEANINGS as m (m.id)}
          <button role="radio" aria-checked={settings.wordMeaning === m.id} onclick={() => (settings.wordMeaning = m.id)}>{m.name === 'Below' ? 'Word by word' : m.name === 'Hover' ? 'Meanings on hover' : 'No meanings'}</button>
        {/each}
      </div>
      <div class="size" role="group" aria-label="Arabic text size">
        <button class="icon" aria-label="Zoom out" title={`Zoom out · ${sizePct}%`} disabled={settings.size <= 24} onclick={() => (settings.size = Math.max(24, settings.size - 4))}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /><line x1="8" x2="14" y1="11" y2="11" /></svg>
        </button>
        <button class="icon" aria-label="Zoom in" title={`Zoom in · ${sizePct}%`} disabled={settings.size >= 96} onclick={() => (settings.size = Math.min(96, settings.size + 4))}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /><line x1="11" x2="11" y1="8" y2="14" /><line x1="8" x2="14" y1="11" y2="11" /></svg>
        </button>
      </div>
    {/if}
    {#if !paged}
      {@const fl = settings.follow === 'lock' ? 'Locked' : settings.follow === 'follow' ? 'On' : 'Off'}
      <button class="icon" class:on={settings.follow !== 'off'} aria-label="Follow: {fl}" title="Follow: {fl} (click to change)" onclick={() => (settings.follow = settings.follow === 'off' ? 'follow' : settings.follow === 'follow' ? 'lock' : 'off')}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" />{#if settings.follow === 'lock'}<path d="M7 11V7a5 5 0 0 1 10 0v4" />{:else}<path d="M7 11V7a5 5 0 0 1 9.9-1" />{/if}</svg>
      </button>
    {/if}
    {#if paged && reader.page}
      <span class="where">Page {reader.page.page} · Juz {reader.page.juz}</span>
    {/if}
  </div>

  {#if player.error}
    <div class="msg">
      <p>{player.error}</p>
      <button class="retry" onclick={() => player.load(player.chapter, false)}>Try again</button>
    </div>
  {:else if notReady}
    <!-- the chosen surah's text is not in yet: its skeleton shows from the first frame, never the previous surah -->
    {#if paged}
      <div class="stage" role="presentation">
        <div class="view" style:--pz={settings.pageZoom}>
          <div class="book cur" class:fill={settings.pageFit === 'fill'} class:spread={settings.spread}>
            <PageSheet page={null} placeholder side={settings.spread ? 'right' : 'single'} />
            {#if settings.spread}<PageSheet page={null} placeholder side="left" />{/if}
          </div>
        </div>
      </div>
    {:else if mushafMode}
      <main class="scroll" class:fill={settings.pageFit === 'fill'} style:--pz={settings.pageZoom} aria-busy="true">
        <div class="pages"><div class="pg"><PageSheet page={null} placeholder /></div></div>
      </main>
    {:else}
      <main class="scroll" aria-busy="true">
        <div class="head">
          <div class="sk-head"><Skeleton w="90px" h="12px" /><Skeleton w="min(280px, 70%)" h="56px" /><Skeleton w="180px" h="14px" /></div>
        </div>
        <div class="verses">
          <p class="sk-sr" role="status">Loading the surah</p>
          {#each [5, 4, 6, 3, 5] as n}
            <div class="verse sk-verse">
              <div class="sk-ar"><Skeleton lines={Math.ceil(n / 3)} h="calc(var(--ar-size, 28px) * 0.7)" widths={['100%', '92%', '64%']} align="end" gap="calc(var(--ar-size, 28px) * 0.5)" /></div>
              {#if settings.translation}<Skeleton lines={2} h="12px" widths={['96%', '70%']} />{/if}
            </div>
          {/each}
        </div>
      </main>
    {/if}
  {:else if paged && reader.page}
    <!-- ───────── Mushaf pages ───────── -->
    <div class="stage hl-sweep" bind:this={stage} onwheel={wheel} ontouchstart={touchStart} ontouchend={touchEnd} role="presentation">
      <!-- Arabic books open from the right: the next page is on the left -->
      <button class="turn next" onclick={() => reader.go(1)} disabled={!reader.canForward} aria-label="Next page (Page Down)">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>

      <div class="view" bind:this={view} style:--pz={settings.pageZoom}>
      {#each kept as k (k)}
        {@const sp = settings.spread ? reader.spreadAt(k) : null}
        <div class="book" class:fill={settings.pageFit === 'fill'} class:spread={settings.spread} class:cur={k === curKey} class:after={k > curKey} class:before={k < curKey} class:ready={waitingReady} inert={k !== curKey} aria-hidden={k !== curKey}>
          {#if sp}
            <PageSheet page={sp.left} no={sp.leftNo} side="left" wait={!(settledL[k] ?? false) || !(settledR[k] ?? false)} bind:settled={settledL[k]} live={k === curKey} last={sp.left?.page === reader.pages[lastIdx]?.page} />
            <PageSheet page={sp.right} no={sp.rightNo} side="right" wait={!(settledL[k] ?? false) || !(settledR[k] ?? false)} bind:settled={settledR[k]} live={k === curKey} last={sp.right?.page === reader.pages[lastIdx]?.page} />
          {:else}
            <PageSheet page={reader.pages[k]} live={k === curKey} last={k === lastIdx} />
          {/if}
        </div>
      {/each}
      </div>

      <button class="turn prev" onclick={() => reader.go(-1)} disabled={!reader.canBack} aria-label="Previous page (Page Up)">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  {:else}
    <main class="scroll" class:fill={settings.pageFit === 'fill'} style:--pz={settings.pageZoom} bind:this={scroller} onwheel={moved} ontouchmove={moved} onscroll={onscroll} onpointerdown={() => (pressing = true)}>
      {#if player.current}
        <div class="head">
          <p class="kicker">{player.current.revelation_place} · {player.current.verses_count} verses</p>
          <h2 class="surah-frame frame-{frameFor(settings.theme, settings.needsIndo)}"><b>{player.current.name_arabic}</b></h2>
          <p class="sub2">{surahName} — {player.current.translated_name.name}</p>
          <div class="head-actions">
            <button class="listen" onclick={() => player.toggle()}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>Listen
            </button>
          </div>
        </div>
      {/if}

      {#if player.current?.bismillah_pre}
        <p class="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</p>
      {/if}

      {#if mushafMode}
        <!-- scroll: the printed pages one after another -->
        <div class="pages hl-sweep">
          {#each reader.pages.slice(0, upto) as pg, i (pg.page)}
            <div class="pg" data-i={i} use:watchPage>{#if built(i)}<PageSheet page={pg} last={i === lastIdx} stagger live={inView.has(i)} />{/if}</div>
          {/each}
        </div>
      {:else if reading}
        <!-- reading, translation only -->
        <article class="tflow">
          {#if !settings.translation}
            <p class="hint">Choose a translation above to read it here.</p>
          {/if}
          {#each player.verses.slice(0, upto) as v (v.n)}
            <p id="t-{v.n}" class:target={ui.target === v.n} class:now={activeVerse === v.n || ui.pick?.verse === v.n && ui.pick.pos === 0}>
              <button class="vn" class:saved={settings.highlightBookmarks && bookmarks.has(player.chapter, v.n)} onclick={() => (ui.pick = { chapter: player.chapter, verse: v.n, pos: 0 })} id="end-{v.n}" aria-label="Verse {v.n} options">{v.n}</button>
              {v.translation ?? ''}
            </p>
          {/each}
        </article>
      {:else}
        <!-- verse by verse -->
        <div class="verses hl-sweep">
          {#each player.verses.slice(0, upto) as v (v.n)}
            {@const saved = bookmarks.has(player.chapter, v.n)}
            <section class="verse" id="v-{v.n}" class:target={ui.target === v.n} class:now={activeVerse === v.n || (ui.pick?.verse === v.n)}>
              <div class="tools">
                <span class="ref">{player.chapter}:{v.n}</span>
                <button class="icon" onclick={() => player.playVerse(v.n)} aria-label="Play verse {v.n}" title="Play this verse">
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
                </button>
                <button class="icon" class:on={saved} onclick={() => toggleBookmark(v.n)} aria-pressed={saved} aria-label={saved ? 'Remove bookmark' : 'Bookmark verse'} title={saved ? 'Remove bookmark' : 'Bookmark'}>
                  <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M5.5 2.8h9v14.4L10 13.6l-4.5 3.6z" /></svg>
                </button>
                <button class="icon" onclick={() => copyVerse(v.n)} aria-label="Copy verse" title="Copy verse">
                  <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="7" y="7" width="9.5" height="9.5" rx="2" /><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></svg>
                </button>
                <button class="icon verse-tafsir" class:on={settings.tafsirFor(player.chapter, v.n)} aria-pressed={settings.tafsirFor(player.chapter, v.n)} onclick={() => toggleVerseTafsir(v.n)} aria-label="View tafsir" title="View tafsir">
                  <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M10 5.2C8.4 4.2 5.6 3.8 2.8 4.4v10.8c2.8-.6 5.6-.2 7.2.8 1.6-1 4.4-1.4 7.2-.8V4.4c-2.8-.6-5.6-.2-7.2.8zM10 5.2V16" /></svg><i aria-hidden="true"></i>
                </button>
              </div>
              <div class="ar" class:below dir="rtl">
                {#if glyphPending(v)}
                  <Skeleton label="Loading the verse text" lines={Math.max(1, Math.min(4, Math.ceil(v.words.length / 6)))} h="calc(var(--ar-size, 28px) * 0.7)" widths={['100%', '90%', '60%']} align="start" gap="calc(var(--ar-size, 28px) * 0.5)" />
                {:else}
                  {#each v.words as w (w.pos)}
                    <Word ch={player.chapter} {v} {w} {below} />{' '}
                  {/each}<End ch={player.chapter} {v} />
                {/if}
              </div>
              {#if settings.translation && v.translation && settings.wordMeaning !== 'off'}
                <p class="tr" dir="auto">{v.translation}</p>
              {/if}
              {#if settings.tafsirFor(player.chapter, v.n)}
                {@const chapterKey = tafsirChapterKey(player.chapter, settings.tafsirEdition)}
                {@const tafsirKey = tafsirVerseKey(player.chapter, v.n, settings.tafsirEdition)}
                {@const commentary = tafsirText[tafsirKey]}
                {#if commentary}
                  {@const editionName = tafsirs.get(settings.tafsirEdition)?.name ?? 'Tafsir'}
                  {@const repeatedFrom = repeatedTafsirFrom(player.chapter, v.n, settings.tafsirEdition, commentary)}
                  <div class="tafsir-text" dir="auto" style:font-size="calc(var(--tr-size) * 0.9)">
                    {#if repeatedFrom}<small class="tafsir-repeat">Same tafsir as verse {repeatedFrom}</small>{/if}
                    <b>{editionName}</b><p>{commentary}</p>
                  </div>
                {:else if tafsirLoading[chapterKey]}
                  <div class="tafsir-text" role="status" aria-busy="true"><Skeleton label="Loading tafsir" lines={3} h="12px" widths={['34%', '100%', '88%']} gap="9px" /></div>
                {:else if tafsirErrors[chapterKey]}
                  <div class="tafsir-status" role="alert"><span>{tafsirErrors[chapterKey]}</span><button class="secondary sm" onclick={() => loadTafsir(player.chapter, settings.tafsirEdition)}>Retry</button></div>
                {:else}
                  <p class="tafsir-status tafsir-unavailable" role="status"><b>Tafsir not available for this verse</b><span>Try another edition from the Tafsir menu.</span></p>
                {/if}
              {/if}
            </section>
          {/each}
        </div>
      {/if}
      <div class="tail"></div>
    </main>
    {#if away && settings.follow !== 'lock'}
      <button class="back" class:lift={ui.barOver} class:up={away === 'up'} onclick={backToPlaying} aria-label="Back to the verse being recited" title="Back to the verse being recited">
        <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4v12M5 11l5 5 5-5" /></svg>
      </button>
    {/if}
  {/if}
</div>

<style>
  .reader { position: relative; flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; font-family: var(--ui); }
  .sk-head { display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .sk-verse { display: flex; flex-direction: column; gap: 16px; content-visibility: visible; }
  .sk-ar { align-self: stretch; }
  .sk-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .msg { margin: auto; color: var(--ink-dim); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .retry { height: 34px; padding: 0 18px; border-radius: var(--r-pill); background: var(--btn); color: var(--ink); font-weight: 550; font-size: var(--t-body); transition: background-color 0.15s; }
  .retry:hover { background: var(--btn-hover); }

  /* ───── sub bar ───── */
  .sub { flex: none; align-self: center; width: fit-content; max-width: calc(100% - 24px); margin: 10px auto 0; display: flex; align-items: center; gap: 0; height: 36px; min-height: 36px; padding: 0 4px; border: 1px solid var(--hair); border-radius: var(--r-lg); background: var(--chrome); box-shadow: var(--e2); position: relative; z-index: 4; overflow-x: auto; scrollbar-width: none; }
  .sub::-webkit-scrollbar { display: none; }
  .sub > * + * { margin-left: 4px; padding-left: 4px; border-left: 1px solid var(--hair); }
  .back { position: absolute; right: 22px; bottom: 18px; width: 42px; height: 42px; border-radius: var(--r-pill); display: grid; place-items: center; background: var(--accent); color: var(--accent-ink); box-shadow: var(--e1); z-index: 5; transition: transform 0.15s var(--ease), opacity 0.15s; }
  .back.lift { bottom: 118px; }
  .back:hover { transform: scale(1.06); }
  .back.up svg { transform: rotate(180deg); }
  .where { color: var(--muted); font-size: 12.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .seg { display: inline-flex; background: transparent; border: 0; border-radius: var(--r-sm); padding: 0; gap: 2px; flex: none; }
  .seg button { padding: 0 11px; height: 28px; border-radius: var(--r-sm); font-size: 13px; font-weight: 500; color: var(--muted); white-space: nowrap; transition: background-color 0.2s, color 0.2s; }
  .seg button:hover:not([aria-checked='true']) { color: var(--ink); background: var(--ink-6); }
  .seg button[aria-checked='true'] { background: var(--on-bg); color: var(--on-fg); font-weight: 600; box-shadow: var(--on-ring); }
  .tafsir-note { color: var(--muted); font-size: 12.5px; white-space: nowrap; }
  .icon { min-width: 32px; width: 32px; height: 28px; padding: 0; border-radius: var(--r-sm); display: inline-grid; place-items: center; color: var(--muted); background: transparent; border: 0; font-size: 12.5px; font-weight: 600; transition: background-color 0.15s, color 0.15s, border-color 0.15s; }
  .icon:hover:not(:disabled) { background: var(--ink-6); color: var(--ink); }
  .icon.on { color: var(--on-fg); background: var(--on-bg); box-shadow: var(--on-ring); }
  .icon.on:hover:not(:disabled) { background: var(--on-bg-hover); color: var(--on-fg); }
  .icon:disabled { opacity: 0.4; }
  .size { gap: 0; display: inline-flex; align-items: center; }
  .pick { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted); flex: none; }

  /* ───── page stage ───── */
  .stage { flex: 1; min-height: 0; position: relative; background: transparent; }
  .view { position: absolute; inset: 0; overflow: auto; display: grid; place-items: safe center; container-type: size; padding: 0 12px; }
  .book { --sh: calc(min(calc(100cqh - 24px), calc((100cqw - 140px) / 0.66)) * var(--pz, 1)); grid-area: 1 / 1; display: flex; opacity: 0; visibility: hidden; transition: opacity 0.34s var(--ease), transform 0.34s var(--ease), visibility 0s linear 0.34s; }
  /* the next pages wait on the left, the earlier ones on the right (Arabic books turn that way) */
  .book.after { transform: translateX(-28px); }
  .book.before { transform: translateX(28px); }
  .book:not(.cur):not(.ready) { content-visibility: hidden; }
  .book.cur { opacity: 1; visibility: visible; transform: none; transition-delay: 0s; }
  .book.spread { --sh: calc(min(calc(100cqh - 8px), calc((100cqw - 104px) / 1.32)) * var(--pz, 1)); }
  /* fill: the page takes the full width of the window, and the window scrolls down it */
  .book.fill { --sh: calc(((100cqw - 96px) / 0.66) * var(--pz, 1)); }
  .book.fill.spread { --sh: calc(((100cqw - 64px) / 1.32) * var(--pz, 1)); }
  .turn { position: absolute; top: 50%; translate: 0 -50%; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; color: var(--muted); background: var(--chrome); border: 1px solid var(--hair); box-shadow: var(--e2); transition: background-color 0.15s, color 0.15s, opacity 0.15s, border-color 0.15s; z-index: 2; }
  .turn:hover:not(:disabled) { background: color-mix(in oklab, var(--chrome) 90%, var(--ink) 10%); color: var(--ink); }
  .turn:disabled { opacity: 0.25; }
  .turn.next { left: 14px; }
  .turn.prev { right: 14px; }

  /* ───── scrolling views ───── */
  /* smooth for keys and the Back arrow; jumps to a verse or the top say `instant` themselves */
  @media (prefers-reduced-motion: no-preference) { .scroll { scroll-behavior: smooth; } }
  /* the book grows above the reader: the scroll position is kept by hand (see growUp), not by the browser's anchoring */
  .scroll { background: transparent; flex: 1; overflow: auto; overflow-anchor: none; padding: 0 clamp(20px, 6vw, 96px); min-width: 0; container-type: inline-size; }
  .head { text-align: center; padding: 40px 0 20px; }
  .kicker { font-size: var(--t-meta); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); }
  h2 { width: 100%; max-width: 760px; aspect-ratio: 8.11; display: flex; align-items: center; justify-content: center; margin: 8px auto; }
  h2 b { font-family: 'KFGQPC Uthmanic Hafs', serif; font-weight: 400; font-size: clamp(30px, 4.4vw, 48px); line-height: 1; }
  .sub2 { color: var(--ink-dim); }
  .head-actions { margin-top: 16px; display: flex; justify-content: center; gap: 10px; }
  .listen { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 18px; border-radius: var(--r-pill); background: var(--accent); color: var(--accent-ink); font-weight: 600; font-size: var(--t-body); transition: transform 0.15s var(--ease), opacity 0.15s; }
  .listen:hover { opacity: 0.92; }
  .listen:active { transform: scale(0.97); }
  .bismillah { font-family: 'KFGQPC Uthmanic Hafs', serif; font-size: calc(var(--ar-size) * 0.95); text-align: center; color: var(--ink-dim); margin: 14px 0 10px; line-height: 2; }
  .tail { height: 120px; }

  .pages { display: flex; flex-direction: column; align-items: safe center; gap: 28px; padding-top: 8px; }
  .pg { content-visibility: auto; contain-intrinsic-size: auto var(--sh); contain: layout paint style; --sh: calc(min(760px, 100cqw) * var(--pz, 1) / 0.66); height: var(--sh); aspect-ratio: 0.66; flex: none; }

  .scroll.fill { padding: 0 12px; }
  .scroll.fill .pg { --sh: calc(100cqw * var(--pz, 1) / 0.66); }
  .pct { min-width: 40px; text-align: center; font-size: 12.5px; font-variant-numeric: tabular-nums; color: var(--ink-dim); }
  .verses { max-width: 900px; margin: 0 auto; }
  /* verses off screen are not laid out: a change of text size only has to lay out what is in view */
  .verse { content-visibility: auto; contain-intrinsic-size: auto 240px; padding: 18px 14px 22px; border-radius: var(--r-lg); transition: background-color 0.3s; border-bottom: 1px solid var(--line); }
  .verse.target, .tflow p.target { background: color-mix(in oklab, var(--accent) 16%, transparent); box-shadow: inset 3px 0 0 var(--accent), 0 0 0 1px color-mix(in oklab, var(--accent) 55%, transparent); border-radius: var(--r-md); }
  .verse.now { background: color-mix(in oklab, var(--accent) 9%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
  .tools { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .tools .icon { min-width: 40px; height: 38px; border-radius: var(--r-md); }
  .tools .icon svg { width: 22px; height: 22px; }
  .tools .verse-tafsir { position: relative; width: 40px; min-width: 40px; padding: 0; display: grid; place-items: center; flex: 0 0 40px; }
  .tools .verse-tafsir i { display: none; }
  .tools .verse-tafsir.on { color: var(--on-fg); }
  .tools .verse-tafsir.on i { display: block; position: absolute; width: 4px; height: 4px; border-radius: 50%; background: var(--on-fg); bottom: 3px; right: 3px; }
  .ref { font-size: 16px; color: var(--ink-dim); font-variant-numeric: tabular-nums; margin-right: 8px; min-width: 42px; }
  .ar { text-align: right; line-height: var(--ar-lh); }
  .ar.below { display: flex; flex-wrap: wrap; gap: 4px 18px; justify-content: flex-start; align-items: flex-start; }
  .tr { margin-top: 12px; font-size: var(--tr-size); line-height: 1.7; color: color-mix(in oklab, var(--ink) 88%, var(--bg)); max-width: 68ch; user-select: text; -webkit-user-select: text; }
  .tafsir-text { margin-top: 14px; width: 100%; max-width: 100%; box-sizing: border-box; padding: 18px 20px; border-inline-start: 3px solid var(--accent); border-radius: var(--r-sm) var(--r-md) var(--r-md) var(--r-sm); color: var(--ink); background: color-mix(in oklab, var(--accent) 7%, var(--bg-2)); font-size: 18px; line-height: 1.8; user-select: text; -webkit-user-select: text; }
  .tafsir-text b { display: block; margin-bottom: 6px; color: var(--accent); font-size: var(--t-meta); }
  .tafsir-text p { margin: 0; white-space: pre-line; unicode-bidi: plaintext; }
  .tafsir-repeat { display: inline-block; margin: 0 0 10px; padding: 4px 8px; border-radius: var(--r-pill); color: var(--accent); background: var(--btn-on); font-size: var(--t-meta); font-weight: 650; }
  .tafsir-status { display: flex; align-items: center; gap: 10px; margin-top: 10px; color: var(--ink-dim); font-size: var(--t-meta); }
  .tafsir-unavailable { align-items: flex-start; flex-direction: column; gap: 3px; max-width: 68ch; padding: 11px 13px; border-inline-start: 3px solid var(--accent); border-radius: var(--r-sm) var(--r-md) var(--r-md) var(--r-sm); color: var(--ink); background: color-mix(in oklab, var(--accent) 10%, var(--bg-2)); }
  .tafsir-unavailable b { font-size: var(--t-body); color: var(--ink); }
  .tafsir-unavailable span { color: var(--ink); }

  .tflow { max-width: 740px; margin: 0 auto; padding-top: 8px; }
  .tflow p { font-size: var(--tr-size); line-height: 1.85; padding: 8px 12px; border-radius: var(--r-md); color: var(--ink); user-select: text; -webkit-user-select: text; transition: background-color 0.3s; }
  .tflow p.now { background: color-mix(in oklab, var(--accent) 8%, transparent); }
  .vn { display: inline-grid; place-items: center; min-width: 26px; height: 22px; padding: 0 6px; margin-right: 8px; border-radius: var(--r-pill); background: var(--accent-soft); color: var(--accent); font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; vertical-align: 1px; }
  .vn:hover { background: color-mix(in oklab, var(--accent) 28%, transparent); }
  .vn.saved { background: var(--on-track); color: var(--bg); }
  .hint { color: var(--ink-dim); text-align: center; padding: 30px 0; }
</style>
