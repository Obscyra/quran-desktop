<script module lang="ts">
  // A page that scrolls out of the window and back is built again; its fitted size does not change, so remember it.
  const fitted = new Map<string, { fs: string; short: boolean[] }>();
  // Zooming only scales the page: its text size stays the same fraction of the page width, so after one measuring
  // a new zoom level is a multiplication, not a measuring of every word again (which made zoom lag).
  const scaled = new Map<string, { r: number; aspect: number; short: boolean[] }>();
  // The text size of each Mushaf page was measured once, when the app was prepared (scripts/learn-fit.mjs), and ships with it:
  // a page of the standard layout in the page fonts is then sized by a division, without measuring any word.
  // r is the text size as a fraction of the page width, a the width over the row height, s the lines that are centred (1).
  type Seed = { r: number; a: number; s: string };
  const seed = seedData as Record<string, Seed>;
  // dev only: what this session measured, for the script to collect
  const learned: Record<string, Seed> = {};
  if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __fitLearned: typeof learned }).__fitLearned = learned;
</script>

<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { pageFonts } from '$lib/fonts.svelte';
  import seedData from '$lib/fit-data.json';
  import { whenIdle } from '$lib/platform';
  import type { MushafPage } from '$lib/pages';
  import { player } from '$lib/player.svelte';
  import { reader } from '$lib/reader.svelte';
  import { settings } from '$lib/settings.svelte';
  import End from './End.svelte';
  import Word from './Word.svelte';

  let {
    page,
    no = 0,
    last = false,
    side = 'single',
    live = true,
    stagger = false
  }: { page: MushafPage | null; no?: number; last?: boolean; side?: 'single' | 'left' | 'right'; live?: boolean; stagger?: boolean } = $props();

  // A page built while scrolling is drawn a few lines per frame, so no single frame has the whole page to do.
  const STEP = 4;
  let shown = $state(untrack(() => (stagger ? STEP : 99)));
  const full = $derived(shown >= (page?.lines.length ?? 0));
  $effect(() => {
    if (full) return;
    shown; // each step schedules the next
    const id = requestAnimationFrame(() => (shown += STEP));
    return () => cancelAnimationFrame(id);
  });
  $effect(() => {
    if (full) untrack(schedule);
  });

  let lines = $state<HTMLElement>();
  const ROWS_PER_PAGE = 15;

  // Rows to draw: a surah's first page reserves rows above its text for the name banner (and the
  // Bismillah line for surahs that open with one), exactly where the printed page leaves them.
  const geo = $derived.by(() => {
    if (!page?.lines.length) return null;
    const first = page.lines[0].line;
    const end = page.lines[page.lines.length - 1].line;
    const top = page.hasStart ? first - (player.current?.bismillah_pre ? 2 : 1) : first;
    return { first, end, top, rows: end - top + 1 };
  });

  /**
   * Size the Arabic so the widest line exactly fills the page width, but never taller than a row.
   * Lines of any script are measured, not guessed, so nothing overflows or overlaps.
   */
  function fit() {
    const box = lines;
    if (!box || !full) return;
    const rows = [...box.querySelectorAll<HTMLElement>('.line')];
    if (!rows.length) return;
    const rowH = rows[0].clientHeight;
    const avail = box.clientWidth;
    if (!rowH || !avail) return;
    // Rects are in screen pixels, scaled by the interface size and by any glide the page is in the middle of
    // (a transform): divide that out, so the size is right whenever the measuring happens.
    const k = box.getBoundingClientRect().width / avail || 1;
    const glyph = settings.script === 'mushaf';
    const key = `${page?.page}|${settings.script}|${settings.layout}|${settings.uiScale}|${settings.fontFamily}|${pageFonts.tick}|${avail}|${rowH}|${rows.length}`;
    const hit = fitted.get(key);
    if (hit) {
      box.style.setProperty('--fs', hit.fs);
      rows.forEach((ln, i) => ln.classList.toggle('short', hit.short[i]));
      return;
    }
    const sKey = `${page?.page}|${settings.script}|${settings.layout}|${settings.uiScale}|${settings.fontFamily}|${pageFonts.tick}|${rows.length}`;
    const aspect = avail / rowH;
    // the standard layout in the page fonts: the size that shipped with the app, if this page (as it is now) is in it
    const standard = glyph && settings.layout === 'madani' && !!page && pageFonts.has(page.page);
    const id = standard ? `${player.chapter}:${page!.page}:${rows.length}:${page!.lines.reduce((n, l) => n + l.cells.length, 0)}` : '';
    const shipped = standard ? seed[id] : undefined;
    if (shipped && Math.abs(aspect / shipped.a - 1) < 0.05) {
      const cap = rowH * 0.74;
      let fs = Math.min(cap, shipped.r * avail);
      box.style.setProperty('--fs', `${fs.toFixed(2)}px`);
      // text widths are not exactly in step with the size on every machine (hinting rounds some), so check the widest line once
      // (one layout of this page) and correct the size by what it shows
      const gap = parseFloat(getComputedStyle(rows[0]).columnGap || '0');
      let widest = 0;
      rows.forEach((ln, i) => {
        if (shipped.s[i] === '1' || ln.classList.contains('center')) return;
        let w = 0;
        for (const c of ln.children) w += (c as HTMLElement).getBoundingClientRect().width / k;
        widest = Math.max(widest, w + Math.max(0, ln.children.length - 1) * gap);
      });
      if (widest) fs = Math.min(cap, (fs * avail) / widest);
      const short = rows.map((_, i) => shipped.s[i] === '1');
      box.style.setProperty('--fs', `${fs.toFixed(2)}px`);
      rows.forEach((ln, i) => ln.classList.toggle('short', short[i]));
      fitted.set(key, { fs: `${fs.toFixed(2)}px`, short });
      return;
    }
    const near = scaled.get(sKey);
    if (near && Math.abs(aspect / near.aspect - 1) < 0.05) {
      // a hair under, so rounding to whole pixels can never push the widest line past the edge
      const fs = (near.r * avail * 0.998).toFixed(2);
      box.style.setProperty('--fs', `${fs}px`);
      rows.forEach((ln, i) => ln.classList.toggle('short', near.short[i]));
      fitted.set(key, { fs: `${fs}px`, short: near.short });
      return;
    }
    const cap = rowH * (glyph ? 0.74 : 0.6);
    const gap = parseFloat(getComputedStyle(rows[0]).columnGap || '0');
    const width = (ln: HTMLElement) => {
      let w = 0;
      for (const c of ln.children) w += (c as HTMLElement).getBoundingClientRect().width / k;
      return w + Math.max(0, ln.children.length - 1) * gap;
    };
    // widths scale with the font: measure every line once, solve for the right size, then check the widest line
    let fs = Math.max(10, cap);
    box.style.setProperty('--fs', `${fs}px`);
    let widest = 0;
    let widestRow = rows[0];
    let natural = rows.map((ln) => {
      const w = width(ln);
      if (!ln.classList.contains('center') && w > widest) {
        widest = w;
        widestRow = ln;
      }
      return w;
    });
    if (widest) {
      let next = Math.min(cap, (fs * avail) / widest);
      for (let i = 0; i < 2 && Math.abs(next - fs) >= 0.05; i++) {
        natural = natural.map((w) => (w * next) / fs);
        fs = next;
        box.style.setProperty('--fs', `${fs.toFixed(2)}px`);
        const w = width(widestRow);
        next = Math.min(cap, (fs * avail) / w);
      }
    }
    box.style.setProperty('--fs', `${fs.toFixed(2)}px`);
    // lines far shorter than the page (a surah's closing line) are centred, not stretched
    const short = natural.map((w) => w < avail * 0.62);
    rows.forEach((ln, i) => ln.classList.toggle('short', short[i]));
    fitted.set(key, { fs: box.style.getPropertyValue('--fs'), short });
    scaled.set(sKey, { r: fs / avail, aspect, short });
    if (import.meta.env.DEV && standard) learned[id] = { r: +(fs / avail).toFixed(5), a: +aspect.toFixed(3), s: short.map((x) => (x ? '1' : '0')).join('') };
  }

  let raf = 0;
  let later = 0;
  let stale = false;
  // The page being read is fitted at once; one waiting off-screen is fitted a moment later (and the instant it is
  // turned to), so a change of room does not make every page on hand work in the same frame.
  const schedule = () => {
    cancelAnimationFrame(raf);
    cancelIdleCallback?.(later);
    if (live) {
      stale = false;
      raf = requestAnimationFrame(fit);
    } else {
      stale = true;
      // fitted as soon as the browser is idle, so the page is finished before it scrolls into view
      later = whenIdle(() => {
        stale = false;
        raf = requestAnimationFrame(fit);
      });
    }
  };
  $effect(() => {
    if (live && stale) untrack(schedule);
  });

  $effect(() => {
    page;
    pageFonts.tick;
    settings.script;
    settings.layout;
    settings.uiScale;
    player.verses;
    tick().then(schedule);
  });

  onMount(() => {
    const ro = new ResizeObserver(schedule);
    if (lines) ro.observe(lines);
    if (document.fonts.status !== 'loaded') document.fonts.ready.then(schedule);
    // a script style's font arrives after the first measure: measure again once it is in
    document.fonts.addEventListener('loadingdone', schedule);
    return () => {
      document.fonts.removeEventListener('loadingdone', schedule);
      ro.disconnect();
      cancelAnimationFrame(raf);
      cancelIdleCallback?.(later);
    };
  });
</script>

<section class="sheet look-{settings.pageLook} {side}" class:blank={!page} aria-label={page ? `Page ${page.page}` : 'Blank page'}>
  {#if page && geo}
    {#if settings.showPageInfo}
      <header>
        <span class="ar">{player.current?.name_arabic}</span>
        <span>Juz {page.juz}</span>
      </header>
    {/if}
    <div class="lines" bind:this={lines} style:grid-template-rows="repeat({geo.rows}, var(--row))">
      {#if page.hasStart && player.current}
        <div class="banner" style:grid-row="1"><b>{player.current.name_arabic}</b></div>
        {#if player.current.bismillah_pre}
          <div class="bsm" style:grid-row="2">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>
        {/if}
      {/if}
      {#each page.lines.slice(0, shown) as ln (ln.line)}
        <div
          class="line"
          class:now={!!reader.activeKey && ln.cells.some((c) => `${c.verse.n}-${c.word.pos}` === reader.activeKey)}
          class:center={page.page <= 2 || ln.cells.length < 4 || (last && ln.line === geo.end)}
          style:grid-row={ln.line - geo.top + 1}
          dir="rtl"
        >
          {#each ln.cells as c (c.word.pos + '-' + c.verse.n)}
            <Word v={c.verse} w={c.word} />{#if c.last}<End v={c.verse} />{/if}
          {/each}
        </div>
      {/each}
    </div>
    {#if settings.showPageInfo}<footer>{page.page}</footer>{/if}
  {:else if no > 0}
    <footer class="solo">{no}</footer>
  {/if}
</section>

<style>
  .sheet {
    --row: calc(100cqh * 0.86 / 15);
    container-type: size;
    position: relative;
    height: var(--sh);
    aspect-ratio: 0.66;
    flex: none;
    display: grid;
    align-content: center;
    padding: 0 clamp(14px, 6cqw, 40px);
    color: var(--ink);
  }
  .sheet.left, .sheet.right { --row: calc(100cqh * 0.92 / 15); padding: 0 clamp(10px, 3.5cqw, 28px); }
  .sheet.left header, .sheet.right header, .sheet.left footer, .sheet.right footer { left: clamp(10px, 3.5cqw, 28px); right: clamp(10px, 3.5cqw, 28px); }
  .look-paper { background: var(--surface); border-radius: 6px; box-shadow: 0 1px 0 var(--line), 0 24px 44px -26px #000c; }
  .look-frame {
    background: var(--surface); border-radius: 4px; box-shadow: 0 24px 44px -26px #000c;
    outline: 1px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: -8px;
  }
  .look-frame::after { content: ''; position: absolute; inset: 12px; border: 3px double color-mix(in srgb, var(--accent) 38%, transparent); border-radius: 2px; pointer-events: none; }
  .look-plain { background: transparent; }
  .left.look-paper, .left.look-frame { border-radius: 6px 0 0 6px; background-image: linear-gradient(to right, #0000 90%, #0003); }
  .right.look-paper, .right.look-frame { border-radius: 0 6px 6px 0; background-image: linear-gradient(to left, #0000 90%, #0003); }
  .blank.look-paper, .blank.look-frame { opacity: 0.55; }

  .lines { --ar-size: var(--fs, 20px); --ar-lh: 1.2; display: grid; width: 100%; }
  .line { display: flex; justify-content: space-between; align-items: center; white-space: nowrap; column-gap: 0.12em; min-width: 0; }
  .line { border-radius: 0.3em; transition: background-color 0.45s ease; }
  .line.now { background: color-mix(in srgb, var(--accent) 6%, transparent); }
  .line.center, .line.short { justify-content: center; column-gap: 0.45em; }
  .banner { display: flex; align-items: center; justify-content: center; border-radius: 8px; background: var(--accent-soft); color: var(--accent); margin: 3px 0; overflow: hidden; border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); }
  .banner b { font-family: 'KFGQPC Uthmanic Hafs', serif; font-weight: 400; font-size: calc(var(--ar-size) * 0.85); line-height: 1; }
  .bsm { display: flex; align-items: center; justify-content: center; font-family: 'KFGQPC Uthmanic Hafs', serif; font-size: calc(var(--ar-size) * 0.9); color: var(--ink-dim); white-space: nowrap; }

  header, footer { position: absolute; left: clamp(14px, 6cqw, 40px); right: clamp(14px, 6cqw, 40px); display: flex; justify-content: space-between; font-size: 11.5px; color: var(--ink-dim); font-variant-numeric: tabular-nums; pointer-events: none; }
  header { top: 2.2cqh; }
  header .ar { font-family: 'KFGQPC Uthmanic Hafs', serif; font-size: 14px; }
  footer { bottom: 2cqh; justify-content: center; }
  footer.solo { top: 50%; bottom: auto; opacity: 0.6; }
</style>
