<script lang="ts">
  import { tick } from 'svelte';
  import { player } from '$lib/player.svelte';
  import { settings } from '$lib/settings.svelte';
  import type { Reciter } from '$lib/types';
  import Qari from './Qari.svelte';

  let { compact = false, value, onpick }: { compact?: boolean; value?: number; onpick?: (id: number) => void } = $props();
  const selected = $derived(value ?? player.reciterId);

  let open = $state(false);
  let query = $state('');
  let btn = $state<HTMLButtonElement>();
  let search = $state<HTMLInputElement>();
  let pos = $state({ left: 0, top: 0, bottom: 0, width: 0, up: true, max: 400 });

  const current = $derived(player.reciters.find((r) => r.id === selected));
  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return q ? player.reciters.filter((r) => `${r.name} ${r.style ?? ''}`.toLowerCase().includes(q)) : player.reciters;
  });

  // recitations that follow along (verse and word highlight) come first, then the listen-only ones
  type Row = { head?: string; note?: string; r?: Reciter };
  const rows = $derived.by((): Row[] => {
    const synced = shown.filter((r) => !r.plain);
    const plain = shown.filter((r) => r.plain);
    if (!plain.length) return synced.map((r) => ({ r }));
    return [
      ...(synced.length ? [{ head: 'Follow along', note: 'Verse and word highlight, play from any verse' }, ...synced.map((r) => ({ r }))] : []),
      { head: 'Listen only', note: 'Whole surah, no highlight or verse stepping' },
      ...plain.map((r) => ({ r }))
    ];
  });

  async function toggle() {
    if (open) return (open = false);
    const r = btn!.getBoundingClientRect();
    const up = r.top > window.innerHeight - r.bottom;
    // rects are in screen pixels; the popup lives inside the scaled interface, so convert
    const z = settings.uiScale;
    pos = {
      left: Math.max(8, Math.min(r.left, window.innerWidth - 392 * z)) / z,
      top: (r.bottom + 6) / z,
      bottom: (window.innerHeight - r.top + 6) / z,
      width: Math.max(r.width / z, 380),
      up,
      max: Math.min(620, ((up ? r.top : window.innerHeight - r.bottom) - 20) / z)
    };
    query = '';
    open = true;
    await tick();
    search?.focus();
    document.querySelector('.rp-list .on')?.scrollIntoView({ block: 'nearest' });
  }
  function choose(id: number) {
    open = false;
    if (onpick) onpick(id);
    else if (id !== player.reciterId) player.setReciter(id);
    btn?.focus();
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      open = false;
      btn?.focus();
    } else if (e.key === 'Enter' && shown.length) choose(shown[0].id);
  }
</script>

<svelte:window onpointerdown={(e) => open && !(e.target as HTMLElement).closest('.rp-pop, .rp-btn') && (open = false)} onresize={() => (open = false)} />

<button class="rp-btn" class:compact bind:this={btn} onclick={toggle} aria-haspopup="listbox" aria-expanded={open} aria-label="Reciter: {current?.name ?? 'choose'}">
  <Qari r={current} size={compact ? 20 : 28} />
  <span class="nm">{current?.name ?? 'Reciter'}</span>
  <svg class="chev" aria-hidden="true" viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
</button>

{#if open}
  <div class="rp-pop" style:left="{pos.left}px" style:width="{pos.width}px" style:max-height="{pos.max}px" style:top={pos.up ? 'auto' : `${pos.top}px`} style:bottom={pos.up ? `${pos.bottom}px` : 'auto'} role="presentation" onkeydown={key}>
    <div class="find">
      <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3.5 3.5" /></svg>
      <input bind:this={search} bind:value={query} placeholder="Search reciters" aria-label="Search reciters" />
    </div>
    <ul class="rp-list" role="listbox" aria-label="Reciters">
      {#each rows as row (row.head ?? row.r?.id)}
        {#if row.head}
          <li class="hd" role="presentation"><b>{row.head}</b><small>{row.note}</small></li>
        {:else if row.r}
          {@const r = row.r}
        <li role="option" aria-selected={r.id === selected} class:on={r.id === selected}>
          <button onclick={() => choose(r.id)}>
            <Qari {r} size={40} />
            <span class="who"><b>{r.name}</b><small>{(r.style ?? 'Murattal') + (r.approx ? ' · word highlight estimated' : '')}</small></span>
            {#if r.id === selected}
              <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8.5 3.2 3L13 4.5" /></svg>
            {/if}
          </button>
        </li>
        {/if}
      {:else}
        <li class="none">No reciter matches “{query}”</li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .rp-btn { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; height: 38px; padding: 0 12px 0 5px; border-radius: var(--r-md); background: var(--btn); border: 1px solid var(--btn-line); color: var(--ink); font-size: var(--t-body); font-weight: 500; transition: background-color 0.15s; }
  .rp-btn:hover { background: var(--btn-hover); }
  .rp-btn.compact { height: 28px; padding: 0 6px 0 3px; background: transparent; border-color: transparent; color: var(--muted); font-size: var(--t-meta); margin-left: -6px; }
  .rp-btn.compact:hover { color: var(--ink); background: color-mix(in oklab, var(--ink) 8%, transparent); }
  .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .chev { flex: none; opacity: 0.6; }

  .rp-pop { position: fixed; z-index: 80; display: flex; flex-direction: column; background: var(--chrome); border: 1px solid var(--hair); border-radius: var(--r-lg); box-shadow: var(--e2); overflow: hidden; animation: rp 0.16s var(--ease); }
  @keyframes rp { from { opacity: 0; transform: translateY(6px) scale(0.98); } }
  .find { flex: none; display: flex; align-items: center; gap: 8px; margin: 8px; padding: 0 10px; height: 36px; border-radius: var(--r-md); background: color-mix(in oklab, var(--ink) 5%, transparent); color: var(--muted); }
  .find:focus-within { box-shadow: 0 0 0 2px var(--accent-soft); }
  .find input { flex: 1; min-width: 0; background: none; border: 0; outline: 0; color: var(--ink); font: inherit; font-size: var(--t-body); }
  .rp-list { list-style: none; margin: 0; padding: 0 6px 6px; overflow-y: auto; }
  .rp-list { display: grid; gap: 2px; }
  .rp-list li button { width: 100%; display: flex; align-items: center; gap: 14px; padding: 0 14px 0 10px; border-radius: var(--r-md); min-height: 48px; text-align: left; color: var(--ink); transition: background-color 0.12s; }
  .rp-list li button:hover { background: var(--ink-6); }
  .rp-list li.on button { background: var(--accent-soft); color: var(--accent); }
  .who { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; text-align: left; }
  .who b { font-size: var(--t-sub); font-weight: 600; }
  .who small { font-size: var(--t-meta); color: var(--muted); }
  .rp-list li.on .who small { color: inherit; opacity: 0.8; }
  .hd { position: sticky; top: 0; z-index: 1; display: flex; flex-direction: column; gap: 1px; padding: 12px 10px 6px; background: var(--chrome); }
  .hd b { font-size: var(--t-cap); letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); font-weight: 650; }
  .hd small { font-size: var(--t-meta); color: var(--muted); }
  .none { padding: 18px; text-align: center; color: var(--muted); font-size: var(--t-body); }
</style>
