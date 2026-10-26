<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { pageFonts } from '$lib/fonts.svelte';
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
    live = true
  }: { page: MushafPage | null; no?: number; last?: boolean; side?: 'single' | 'left' | 'right'; live?: boolean } = $props();

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
    if (!box) return;
    const rows = [...box.querySelectorAll<HTMLElement>('.line')];
    if (!rows.length) return;
    const rowH = rows[0].clientHeight;
    const avail = box.clientWidth;
    if (!rowH || !avail) return;
    const z = settings.uiScale;
    const glyph = settings.script === 'mushaf';
    const cap = rowH * (glyph ? 0.74 : 0.6);
    // rects are in screen pixels; under a scaled interface convert them back to layout pixels
    const gap = parseFloat(getComputedStyle(rows[0]).columnGap || '0');
    const width = (ln: HTMLElement) => {
      let w = 0;
      for (const c of ln.children) w += (c as HTMLElement).getBoundingClientRect().width / z;
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
    rows.forEach((ln, i) => ln.classList.toggle('short', natural[i] < avail * 0.62));
  }

  let raf = 0;
  let later = 0;
  let stale = false;
  // The page being read is fitted at once; one waiting off-screen is fitted a moment later (and the instant it is
  // turned to), so a change of room does not make every page on hand work in the same frame.
  const schedule = () => {
    cancelAnimationFrame(raf);
    clearTimeout(later);
    if (live) {
      stale = false;
      raf = requestAnimationFrame(fit);
    } else {
      stale = true;
      later = window.setTimeout(() => {
        whenIdle(() => {
          stale = false;
          raf = requestAnimationFrame(fit);
        });
      }, 500);
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
    document.fonts.ready.then(schedule);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(later);
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
      {#each page.lines as ln (ln.line)}
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
