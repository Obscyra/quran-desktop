<script lang="ts">
  import { tick } from 'svelte';

  // One tooltip for the whole app. Anything with a `title` shows it here instead of in the web view's plain grey box:
  // the title is moved to `data-tip` while hovered, so the native one never appears. A trailing "(B)" becomes a key chip.
  let tip = $state<{ label: string; key: string; x: number; y: number; above: boolean; arrow: number } | null>(null);
  let box = $state<HTMLElement>();
  let el: HTMLElement | null = null;
  let timer = 0;
  let lastShown = 0;

  const zoom = () => Number(document.documentElement.style.getPropertyValue('--zoom')) || 1;
  function read(t: HTMLElement) {
    const title = t.getAttribute('title');
    if (title !== null) {
      // a title set again by the page (the zoom level changes) replaces what was kept
      if (title) t.dataset.tip = title;
      t.removeAttribute('title');
    }
    return t.dataset.tip ?? '';
  }
  const split = (s: string) => {
    const m = s.match(/^(.*?)\s*\(([^()\s][^()\s]{0,2})\)$/);
    return m ? { label: m[1], key: m[2] } : { label: s, key: '' };
  };

  async function place(target: HTMLElement, text: string) {
    const { label, key } = split(text);
    tip = { label, key, x: -999, y: -999, above: false, arrow: 0 };
    await tick();
    if (!box || el !== target) return;
    const z = zoom();
    const r = target.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const w = b.width / z;
    const h = b.height / z;
    const vw = innerWidth / z;
    const vh = innerHeight / z;
    const cx = (r.left + r.width / 2) / z;
    const x = Math.max(8, Math.min(vw - w - 8, cx - w / 2));
    const below = r.bottom / z + 10 + h <= vh - 6;
    const y = below ? r.bottom / z + 10 : r.top / z - 10 - h;
    tip = { label, key, x, y, above: !below, arrow: Math.max(10, Math.min(w - 10, cx - x)) };
    lastShown = Date.now();
  }
  function hide() {
    watch?.disconnect();
    clearTimeout(timer);
    tip = null;
    el = null;
  }
  function over(e: PointerEvent) {
    const t = (e.target as Element | null)?.closest?.('[title],[data-tip]') as HTMLElement | null;
    if (t === el) return;
    hide();
    if (!t || e.pointerType === 'touch') return;
    const text = read(t);
    if (!text) return;
    el = t;
    follow(t);
    // the first tip waits a moment; moving along a toolbar shows the next one at once
    timer = window.setTimeout(() => place(t, text), Date.now() - lastShown < 400 ? 0 : 450);
  }
  // what the tip says can change while it is shown (the zoom level after a click): say it again, in place, the moment
  // the page sets a new title on the element
  let watch: MutationObserver | undefined;
  function follow(t: HTMLElement) {
    watch?.disconnect();
    watch = new MutationObserver(() => {
      if (el !== t || t.getAttribute('title') === null) return;
      const text = read(t);
      if (text) place(t, text);
      else hide();
    });
    watch.observe(t, { attributes: true, attributeFilter: ['title'] });
  }
</script>

<svelte:window onpointerover={over} onpointerdown={() => clearTimeout(timer)} onscrollcapture={hide} onkeydown={hide} onblur={hide} />
<svelte:document onpointerleave={hide} />

{#if tip}
  <div bind:this={box} class="tip" class:above={tip.above} style:left="{tip.x}px" style:top="{tip.y}px" style:--arrow="{tip.arrow}px" role="tooltip">
    <span>{tip.label}</span>{#if tip.key}<kbd>{tip.key}</kbd>{/if}
  </div>
{/if}

<style>
  .tip {
    position: fixed; z-index: 120; pointer-events: none; display: flex; align-items: center; gap: 9px; max-width: 280px;
    padding: 6px 10px; border-radius: 9px; font-size: 12.5px; font-weight: 500; line-height: 1.35; letter-spacing: 0.005em;
    color: var(--ink); background: color-mix(in srgb, var(--surface) 82%, var(--ink) 6%); border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--line));
    box-shadow: 0 10px 28px -10px #000c, 0 1px 0 color-mix(in srgb, var(--ink) 8%, transparent) inset;
    backdrop-filter: blur(8px); animation: tip 0.14s var(--ease);
  }
  .tip::before {
    content: ''; position: absolute; left: var(--arrow); top: -5px; width: 8px; height: 8px; margin-left: -4px; rotate: 45deg;
    background: inherit; border: inherit; border-right: 0; border-bottom: 0; border-radius: 2px 0 0 0;
  }
  .tip.above::before { top: auto; bottom: -5px; rotate: 225deg; }
  @keyframes tip { from { opacity: 0; translate: 0 3px; } }
  .tip.above { animation-name: tip-up; }
  @keyframes tip-up { from { opacity: 0; translate: 0 -3px; } }
  kbd {
    font: inherit; font-size: 11px; font-weight: 600; min-width: 18px; text-align: center; padding: 1px 6px; border-radius: 5px;
    color: var(--accent); background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  }
</style>
