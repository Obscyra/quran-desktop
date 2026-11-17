<script lang="ts">
  const SIDE_MIN = 260, SIDE_MAX = 480, SIDE_DEFAULT = 324;
  /** Width while the edge is being dragged: the sidebar follows the mouse, one change per frame, and the setting is saved on release. */
  let dragW = $state<number | null>(null);
  function startDrag(e: PointerEvent) {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const zoom = settings.uiScale || 1;
    const x0 = e.clientX, w0 = settings.sidebarWidth;
    const at = (ev: PointerEvent) => Math.round(Math.min(SIDE_MAX, Math.max(SIDE_MIN, w0 + (ev.clientX - x0) / zoom)));
    let last = w0, frame = 0;
    const move = (ev: PointerEvent) => {
      last = at(ev);
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; dragW = last; });
    };
    const up = (ev: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = 0;
      settings.sidebarWidth = at(ev);
      dragW = null;
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    dragW = w0;
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  import { bookmarks } from '$lib/bookmarks.svelte';
  import { confirm } from '$lib/confirm.svelte';
  import { player } from '$lib/player.svelte';
  import { reader } from '$lib/reader.svelte';
  import { settings } from '$lib/settings.svelte';
  import { stars } from '$lib/stars.svelte';
  import { ui } from '$lib/ui.svelte';

  let query = $state('');

  // right-click on a surah: read it, listen to it, keep it offline
  let menu = $state<{ id: number; x: number; y: number } | null>(null);
  let menuEl = $state<HTMLElement>();
  const target = $derived(menu ? player.chapters.find((c) => c.id === menu!.id) : undefined);
  const nameOf = (c: { name_simple: string; name_arabic: string }) => (settings.arabicNames ? c.name_arabic : c.name_simple);
  const savedAudio = $derived(target ? player.isChapterDownloaded(target.id) : false);
  const fetchingAudio = $derived(
    !!target && (player.progress[`${player.reciterId}:${target.id}`] !== undefined || (player.dl.running && player.dl.current.includes(target.id) && player.dl.reciter === player.reciterId))
  );
  const fetchPct = $derived.by(() => {
    const p = target ? player.progress[`${player.reciterId}:${target.id}`] : undefined;
    return p !== undefined && p >= 0 ? Math.round(p * 100) : null;
  });
  const reciterName = $derived(player.reciters.find((r) => r.id === player.reciterId)?.name ?? 'this reciter');

  function openMenu(e: MouseEvent, id: number) {
    e.preventDefault();
    // the pointer is in screen pixels; the menu sits inside the (possibly scaled) interface
    const z = settings.uiScale;
    const W = 248 * z;
    const H = 230 * z;
    menu = { id, x: Math.max(8, Math.min(e.clientX, innerWidth - W - 8)) / z, y: Math.max(8, Math.min(e.clientY, innerHeight - H - 8)) / z };
    queueMicrotask(() => menuEl?.querySelector<HTMLElement>('button')?.focus());
  }
  const closeMenu = () => (menu = null);
  function menuKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeMenu();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...(menuEl?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
      const i = items.indexOf(document.activeElement as HTMLElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    }
  }
  function read() {
    const id = menu!.id;
    closeMenu();
    ui.closeSettings();
    player.load(id, false);
  }
  function listen() {
    const id = menu!.id;
    closeMenu();
    ui.closeSettings();
    player.load(id, true);
  }
  function saveAudio() {
    const id = menu!.id;
    closeMenu();
    player.downloadMany(player.reciterId, [id]);
  }
  async function removeAudio() {
    const c = target!;
    closeMenu();
    const ok = await confirm.ask({
      danger: true,
      steps: [{ title: `Delete ${c.name_simple}?`, body: `Removes the saved recitation by ${reciterName}. You can download it again later.`, ok: 'Delete recitation' }]
    });
    if (ok) await player.removeAudio(player.reciterId, c.id);
  }
  function copyName() {
    const c = target!;
    closeMenu();
    navigator.clipboard?.writeText(`${c.name_simple} (${c.name_arabic}) ${c.id}`).catch(() => {});
  }
  const closed = $derived(!settings.sidebar || ui.settingsOpen);
  const go = (ch: number, v: number) => player.goTo(ch, v);

  // "55:13" jumps straight to a verse
  const ref = $derived.by(() => {
    const m = query.trim().match(/^(\d{1,3})\s*[:.\s]\s*(\d{1,3})$/);
    if (!m) return null;
    const ch = player.chapters.find((c) => c.id === Number(m[1]));
    return ch && Number(m[2]) >= 1 && Number(m[2]) <= ch.verses_count ? { ch, verse: Number(m[2]) } : null;
  });

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q || ref) return player.chapters;
    return player.chapters.filter(
      (c) =>
        String(c.id) === q ||
        c.name_simple.toLowerCase().includes(q) ||
        c.translated_name.name.toLowerCase().includes(q) ||
        c.name_arabic.includes(q)
    );
  });

  // starred surahs are also shown first, in the order they are in the Quran; they keep their place in the full list
  const starred = $derived(shown.filter((c) => stars.has(c.id)));

  let list = $state<HTMLElement>();
  // The scrollbar takes width from the list, so its rows ended short of the search box above. Measure it once
  // (the gutter is always reserved) and let the list reach into the sidebar's padding by that much.
  $effect(() => {
    if (!list) return;
    const w = list.offsetWidth - list.clientWidth;
    list.closest('aside')?.style.setProperty('--sb', `${w}px`);
  });
  // bring the playing surah into view when the list opens or the surah changes
  $effect(() => {
    player.chapter;
    if (closed) return;
    requestAnimationFrame(() => list?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }));
  });
</script>

<!-- on: the surahs whose pages are on screen (the playing one when the recitation is among them); also: visible but not the one marked -->
{#snippet row(c: (typeof player.chapters)[number])}
  {@const tone = !reader.visible.length ? (c.id === player.chapter ? 'on' : '') : !reader.visible.includes(c.id) ? '' : !player.playing || !reader.visible.includes(player.chapter) || c.id === player.chapter ? 'on' : 'also'}
  <li class="surah">
    <button class="pick" aria-label="{c.id}. {c.name_simple}, {c.translated_name.name}, {c.verses_count} verses" title={c.name_arabic} class:on={tone === 'on'} class:also={tone === 'also'} class:ctx={menu?.id === c.id} onclick={() => { ui.closeSettings(); player.load(c.id, player.playing); }} oncontextmenu={(e) => openMenu(e, c.id)}>
      <span class="num">{c.id}</span>
      <span class="names">
        <b>{settings.arabicNames ? c.name_arabic : c.name_simple}</b>
        <small>{c.translated_name.name} · {c.verses_count}</small>
      </span>
      {#if player.isChapterDownloaded(c.id)}<i class="dl" title="Downloaded for offline"></i>{/if}
      {#if settings.arabicNames}<span class="ar latin">{c.name_simple}</span>{:else}<span class="ar" aria-hidden="true">surah{String(c.id).padStart(3, '0')}</span>{/if}
    </button>
    <button class="star" class:starred={stars.has(c.id)} onclick={() => stars.toggle(c.id)} aria-pressed={stars.has(c.id)} aria-label="{stars.has(c.id) ? 'Unstar' : 'Star'} {c.name_simple}" title={stars.has(c.id) ? 'Remove from starred' : 'Star: keep at the top of the list'}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="{stars.has(c.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" /></svg>
    </button>
  </li>
{/snippet}

<aside class:closed inert={closed} style:width="{dragW ?? settings.sidebarWidth}px">
  <div class="inner">
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected={ui.tab === 'surahs'} onclick={() => (ui.tab = 'surahs')}>Surahs</button>
      <button role="tab" aria-selected={ui.tab === 'bookmarks'} onclick={() => (ui.tab = 'bookmarks')}>
        Bookmarks{#if bookmarks.list.length}<span class="count">{bookmarks.list.length}</span>{/if}
      </button>
    </div>
    {#if ui.tab === 'bookmarks'}
      <ul class="marks">
        {#each bookmarks.list as b (b.chapter + ':' + b.verse)}
          {@const c = player.chapters.find((x) => x.id === b.chapter)}
          <li>
            <button class="mark" onclick={() => go(b.chapter, b.verse)}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
              <span class="names">
                <b>{c ? (settings.arabicNames ? c.name_arabic : c.name_simple) : `Surah ${b.chapter}`} {b.chapter}:{b.verse}</b>
                <small>{b.note || 'No note'}</small>
              </span>
            </button>
            <button class="rm" onclick={() => bookmarks.toggle(b.chapter, b.verse)} aria-label="Remove bookmark {b.chapter}:{b.verse}">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </li>
        {:else}
          <li class="empty">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
            <p>No bookmarks yet</p>
            <small>Right-click a word or tap a verse number, then choose Bookmark. In Verse by Verse, use the ribbon on a verse.</small>
          </li>
        {/each}
      </ul>
    {:else}
    <label class="search">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
      <input type="search" name="surah-search" autocomplete="off" spellcheck="false" placeholder="Search, or 55:13" bind:value={query} aria-label="Search surahs, or type a verse like 55:13" onkeydown={(e) => { if (e.key === 'Enter' && ref) { go(ref.ch.id, ref.verse); query = ''; } }} />
    </label>
    {#if ref}
      <button class="go" onclick={() => { go(ref.ch.id, ref.verse); query = ''; }}>Go to {ref.ch.name_simple} {ref.ch.id}:{ref.verse}</button>
    {/if}
    <ul bind:this={list}>
      {#if starred.length}
        <li class="head">Starred</li>
        {#each starred as c (c.id)}{@render row(c)}{/each}
        {#if shown.length}<li class="head">All surahs</li>{/if}
      {/if}
      {#each shown as c (c.id)}{@render row(c)}{/each}
    </ul>
    {/if}
  </div>
  <div class="grip" role="separator" aria-orientation="vertical" aria-label="Resize the sidebar" title="Drag to resize, double-click to reset" onpointerdown={startDrag} ondblclick={() => (settings.sidebarWidth = SIDE_DEFAULT)}></div>
</aside>

<svelte:window onpointerdown={(e) => menu && !(e.target as HTMLElement).closest('.cm') && closeMenu()} onresize={closeMenu} onblur={closeMenu} />

{#if menu && target}
  <div class="cm" bind:this={menuEl} style:left="{menu.x}px" style:top="{menu.y}px" role="menu" aria-label="{target.name_simple} options" tabindex="-1" onkeydown={menuKey}>
    <header><b>{nameOf(target)}</b><small>{target.id} · {target.verses_count} verses</small></header>
    <button role="menuitem" onclick={read}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>Read
    </button>
    <button role="menuitem" onclick={listen}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3" /></svg>Listen<em>{reciterName}</em>
    </button>
    {#if savedAudio}
      <button role="menuitem" onclick={removeAudio}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="m7.6 12.3 3.3 3.2 5.6-6.4" fill="none" stroke="var(--panel)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>Saved offline<em>Remove</em>
      </button>
    {:else if fetchingAudio}
      <button role="menuitem" disabled>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>Downloading<em>{fetchPct === null ? '…' : `${fetchPct}%`}</em>
      </button>
    {:else}
      <button role="menuitem" onclick={saveAudio} disabled={player.dl.running}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>Download audio
      </button>
    {/if}
    <button role="menuitem" onclick={() => { stars.toggle(target!.id); closeMenu(); }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="{stars.has(target.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" /></svg>{stars.has(target.id) ? 'Unstar' : 'Star'}<em>{stars.has(target.id) ? 'Remove from top' : 'Keep at top'}</em>
    </button>
    <button role="menuitem" onclick={copyName}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>Copy name
    </button>
  </div>
{/if}

<style>
  aside { position: relative; flex: none; width: 324px; overflow: hidden; background: var(--chrome); z-index: 6; transition: transform 0.38s var(--ease), opacity 0.28s var(--ease); }
  /* Closed, it leaves the layout at once (the page reflows one time) and slides away; resizing it frame by
     frame made the page refit on every frame. */
  aside.closed { position: absolute; left: 0; top: 0; bottom: 0; transform: translateX(-100%); opacity: 0; pointer-events: none; }
  .inner { width: 100%; height: 100%; display: flex; flex-direction: column; min-height: 0; padding: 8px; }
  .grip { position: absolute; top: 0; right: 0; bottom: 0; width: 7px; cursor: col-resize; z-index: 2; touch-action: none; }
  .grip:hover, .grip:active { background: var(--accent-soft); }
  .search { display: flex; align-items: center; gap: 8px; margin: 0 4px 10px; padding: 0 12px; height: 36px; border-radius: var(--r-md); background: color-mix(in oklab, var(--ink) 5%, transparent); color: var(--muted); }
  .search:focus-within { background: var(--ink-6); box-shadow: 0 0 0 2px color-mix(in oklab, var(--accent) 30%, transparent); }
  input { flex: 1; min-width: 0; background: none; border: 0; outline: 0; color: var(--ink); font: inherit; font-size: 12.5px; user-select: text; }
  input::placeholder { color: var(--ink-faint); }
  ul { list-style: none; padding: 0 0 8px; overflow-y: auto; scrollbar-gutter: stable; margin-right: calc(-1 * var(--sb, 0px)); flex: 1; display: flex; flex-direction: column; gap: 2px; }
  li .pick { flex: 1; min-width: 0; }
  li button { width: 100%; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 6px; height: 48px; border-radius: var(--r-md); text-align: left; transition: background-color 0.12s; }
  li button:hover { background: color-mix(in oklab, var(--ink) 5%, transparent); }
  li button.on { background: color-mix(in oklab, var(--accent) 13%, transparent); }
  li button.also { background: color-mix(in oklab, var(--accent) 7%, transparent); }
  .num { width: 28px; height: 28px; flex: none; display: grid; place-items: center; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .on .num { color: var(--accent); font-weight: 600; }
  .names { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  b { font-weight: 600; font-size: 13.5px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  small { color: var(--muted); font-size: 12.5px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ar { font-family: 'SurahNames'; font-size: 22px; line-height: 1; color: var(--muted); flex: none; }
  .ar.latin { font-family: var(--ui); font-size: 13.5px; font-weight: 500; }
  .on .ar { color: var(--accent); }
  .dl { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex: none; }
  .tabs { display: flex; margin: 4px 4px 10px; background: var(--ink-6); border: 0; border-radius: var(--r-md); padding: 3px; }
  .tabs button { flex: 1; height: 28px; padding: 0; border-radius: var(--r-sm); font-size: 13.5px; font-weight: 500; color: var(--muted); display: flex; align-items: center; justify-content: center; gap: 7px; transition: background-color 0.2s, color 0.2s; }
  .tabs button:hover { color: var(--ink); }
  .tabs button[aria-selected='true'] { background: color-mix(in oklab, var(--bg) 70%, var(--ink) 12%); color: var(--ink); box-shadow: var(--e1); }
  .count { font-size: var(--t-meta); background: var(--accent-soft); color: var(--accent); border-radius: var(--r-pill); padding: 0 7px; font-variant-numeric: tabular-nums; }
  .go { margin: 0 0 12px; height: 36px; border-radius: var(--r-md); background: var(--accent); color: var(--accent-ink); font-weight: 600; font-size: var(--t-body); }
  .marks li { display: flex; align-items: center; gap: 2px; }
  .marks .mark { flex: 1; min-width: 0; align-items: flex-start; }
  .marks .mark { height: auto; min-height: 48px; padding-top: 8px; padding-bottom: 8px; }
  .mark svg { color: var(--accent); flex: none; margin-top: 3px; }
  .mark small { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .rm { width: 32px; height: 32px; border-radius: var(--r-md); color: var(--ink-faint); display: grid; place-items: center; flex: none; }
  .rm:hover { background: color-mix(in oklab, var(--ink) 9%, transparent); color: var(--ink); }
  /* `.marks li` is a row; the empty state is a centred column and must win over it */
  .marks li.empty { flex: 1; flex-direction: column; justify-content: center; align-items: center; gap: 10px; padding: 0 20px 60px; text-align: center; color: var(--ink-dim); }
  .empty svg { color: var(--ink-faint); }
  .empty p { font-size: var(--t-sub); font-weight: 600; color: var(--ink); }
  .empty small { display: block; max-width: 24ch; font-size: var(--t-body); line-height: 1.55; white-space: normal; overflow: visible; }
  li.surah { display: flex; align-items: center; gap: 2px; }
  li.surah .star { width: 32px; height: 32px; flex: none; padding: 0; justify-content: center; border-radius: var(--r-md); color: var(--ink-faint); opacity: 0; transition: opacity 0.12s, color 0.12s, background-color 0.12s; }
  li.surah:hover .star, .star:focus-visible, .star.starred { opacity: 1; }
  .star.starred { color: var(--accent); }
  .star:hover { color: var(--accent); }
  li.head { padding: 14px 12px 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  li button.ctx { background: color-mix(in oklab, var(--ink) 9%, transparent); }

  .cm { position: fixed; z-index: 90; width: 248px; padding: 6px; display: flex; flex-direction: column; gap: 1px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: var(--e2); animation: cm 0.14s var(--ease); }
  @keyframes cm { from { opacity: 0; transform: translateY(-4px) scale(0.98); } }
  .cm header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 8px 10px 8px; margin-bottom: 4px; border-bottom: 1px solid var(--line); }
  .cm header b { font-size: var(--t-body); font-weight: 600; }
  .cm header small { color: var(--ink-dim); font-size: var(--t-meta); white-space: nowrap; }
  .cm button { width: 100%; display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: var(--r-md); font-size: var(--t-body); font-weight: 500; text-align: left; color: var(--ink); }
  .cm button:hover:not(:disabled), .cm button:focus-visible { background: color-mix(in oklab, var(--ink) 10%, transparent); outline: 0; }
  .cm button:disabled { opacity: 0.55; }
  .cm button svg { flex: none; color: var(--ink-dim); }
  .cm button em { margin-left: auto; padding-left: 8px; font-style: normal; font-weight: 400; font-size: var(--t-meta); color: var(--ink-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 110px; }
</style>
