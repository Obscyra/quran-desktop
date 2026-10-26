<script lang="ts">
  import { tick } from 'svelte';
  import { settings } from '$lib/settings.svelte';
  import { translations } from '$lib/translations.svelte';

  let { compact = false, onpick }: { compact?: boolean; onpick: (id: number) => void } = $props();
  const selected = $derived(settings.translation);

  let open = $state(false);
  let query = $state('');
  let btn = $state<HTMLButtonElement>();
  let search = $state<HTMLInputElement>();
  let pos = $state({ left: 0, top: 0, bottom: 0, width: 0, up: true, max: 400 });

  const label = $derived(selected ? translations.name(selected) : 'None');
  /** translations by language; a search matches the name, the translator or the language */
  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return translations.grouped;
    return translations.grouped
      .map(([lang, list]) => [lang, lang.toLowerCase().includes(q) ? list : list.filter((t) => `${t.name} ${t.author}`.toLowerCase().includes(q))] as const)
      .filter(([, list]) => list.length);
  });
  const none = $derived(!query.trim() || 'none'.includes(query.trim().toLowerCase()));

  async function toggle() {
    if (open) return (open = false);
    const r = btn!.getBoundingClientRect();
    const up = r.top > window.innerHeight - r.bottom;
    // rects are in screen pixels; the popup lives inside the scaled interface, so convert
    const z = settings.uiScale;
    pos = {
      left: Math.max(8, Math.min(r.left, window.innerWidth - 372 * z)) / z,
      top: (r.bottom + 6) / z,
      bottom: (window.innerHeight - r.top + 6) / z,
      width: Math.max(r.width / z, 360),
      up,
      max: Math.min(560, ((up ? r.top : window.innerHeight - r.bottom) - 20) / z)
    };
    query = '';
    open = true;
    translations.load();
    await tick();
    search?.focus();
    document.querySelector('.tp-list .on')?.scrollIntoView({ block: 'center' });
  }
  function choose(id: number) {
    open = false;
    if (id !== selected) onpick(id);
    btn?.focus();
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      open = false;
      btn?.focus();
    } else if (e.key === 'Enter') {
      const first = query.trim() ? groups[0]?.[1][0] : undefined;
      if (first) choose(first.id);
    }
  }
</script>

<svelte:window onpointerdown={(e) => open && !(e.target as HTMLElement).closest('.tp-pop, .tp-btn') && (open = false)} onresize={() => (open = false)} />

<button class="tp-btn" class:compact bind:this={btn} onclick={toggle} aria-haspopup="listbox" aria-expanded={open} aria-label="Translation: {label}">
  <span class="nm">{label}</span>
  <svg class="chev" aria-hidden="true" viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
</button>

{#if open}
  <div class="tp-pop" style:left="{pos.left}px" style:width="{pos.width}px" style:max-height="{pos.max}px" style:top={pos.up ? 'auto' : `${pos.top}px`} style:bottom={pos.up ? `${pos.bottom}px` : 'auto'} role="presentation" onkeydown={key}>
    <div class="find">
      <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3.5 3.5" /></svg>
      <input bind:this={search} bind:value={query} placeholder="Search by name, translator or language" aria-label="Search translations" />
    </div>
    <div class="tp-list" role="listbox" aria-label="Translations">
      {#if none}
        <button class="opt" class:on={!selected} role="option" aria-selected={!selected} onclick={() => choose(0)}>
          <span class="who"><b>None</b><small>Arabic only</small></span>
          {#if !selected}{@render check()}{/if}
        </button>
      {/if}
      {#each groups as [lang, list] (lang)}
        <div class="lang">{lang}</div>
        {#each list as t (t.id)}
          <button class="opt" class:on={t.id === selected} role="option" aria-selected={t.id === selected} onclick={() => choose(t.id)}>
            <span class="who"><b>{t.name}</b>{#if t.author && t.author !== t.name}<small>{t.author}</small>{/if}</span>
            {#if t.id === selected}{@render check()}{/if}
          </button>
        {/each}
      {:else}
        {#if !none}<p class="empty">No translation matches “{query}”</p>{/if}
      {/each}
    </div>
  </div>
{/if}

{#snippet check()}
  <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8.5 3.2 3L13 4.5" /></svg>
{/snippet}

<style>
  .tp-btn { display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; max-width: 100%; min-width: 240px; height: 38px; padding: 0 12px; border-radius: 8px; background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink); font-size: 13px; font-weight: 500; transition: background-color 0.15s; }
  .tp-btn:hover { background: color-mix(in srgb, var(--ink) 14%, transparent); }
  .tp-btn.compact { min-width: 0; height: 28px; padding: 0 8px 0 10px; max-width: 220px; font-size: 12.5px; }
  .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .chev { flex: none; opacity: 0.6; }

  .tp-pop { position: fixed; z-index: 80; display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 18px 44px -14px #000b; overflow: hidden; animation: tp 0.16s var(--ease); }
  @keyframes tp { from { opacity: 0; transform: translateY(6px) scale(0.98); } }
  .find { flex: none; display: flex; align-items: center; gap: 8px; margin: 8px; padding: 0 10px; height: 32px; border-radius: 8px; background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink-dim); }
  .find:focus-within { box-shadow: 0 0 0 2px var(--accent-soft); }
  .find input { flex: 1; min-width: 0; background: none; border: 0; outline: 0; color: var(--ink); font: inherit; font-size: 13px; }
  .tp-list { overflow-y: auto; padding: 0 6px 6px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; }
  .lang { position: sticky; top: 0; z-index: 1; padding: 10px 10px 4px; background: var(--panel); font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); }
  .opt { width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 10px; min-height: 44px; text-align: left; color: var(--ink); transition: background-color 0.12s; }
  .opt:hover { background: color-mix(in srgb, var(--ink) 9%, transparent); }
  .opt.on { background: var(--accent-soft); color: var(--accent); }
  .who { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
  .who b { font-size: 14px; font-weight: 600; }
  .who small { font-size: 12px; color: var(--ink-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .opt.on .who small { color: inherit; opacity: 0.8; }
  .empty { padding: 18px; text-align: center; color: var(--ink-dim); font-size: 13px; }
</style>
