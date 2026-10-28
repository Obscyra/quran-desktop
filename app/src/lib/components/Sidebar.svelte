<script lang="ts">
  import { bookmarks } from '$lib/bookmarks.svelte';
  import { confirm } from '$lib/confirm.svelte';
  import { player } from '$lib/player.svelte';
  import { settings } from '$lib/settings.svelte';
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
  const closed = $derived(!settings.sidebar || ui.focus || ui.settingsOpen);
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

  let list = $state<HTMLElement>();
  // bring the playing surah into view when the list opens or the surah changes
  $effect(() => {
    player.chapter;
    if (closed) return;
    queueMicrotask(() => list?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }));
  });
</script>

<aside class:closed inert={closed}>
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
              <svg aria-hidden="true" viewBox="0 0 20 20" width="15" height="15" fill="currentColor"><path d="M5.5 2.8h9v14.4L10 13.6l-4.5 3.6z" /></svg>
              <span class="names">
                <b>{c ? (settings.arabicNames ? c.name_arabic : c.name_simple) : `Surah ${b.chapter}`} {b.chapter}:{b.verse}</b>
                <small>{b.note || 'No note'}</small>
              </span>
            </button>
            <button class="rm" onclick={() => bookmarks.toggle(b.chapter, b.verse)} aria-label="Remove bookmark {b.chapter}:{b.verse}">
              <svg aria-hidden="true" viewBox="0 0 10 10" width="9" height="9"><path d="M.5.5l9 9M9.5.5l-9 9" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
            </button>
          </li>
        {:else}
          <li class="empty">
            <svg aria-hidden="true" viewBox="0 0 20 20" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M5.5 2.8h9v14.4L10 13.6l-4.5 3.6z" /></svg>
            <p>No bookmarks yet</p>
            <small>Right-click a word or tap a verse number, then choose Bookmark. In Verse by Verse, use the ribbon on a verse.</small>
          </li>
        {/each}
      </ul>
    {:else}
    <label class="search">
      <svg aria-hidden="true" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3.5 3.5" /></svg>
      <input type="search" name="surah-search" autocomplete="off" spellcheck="false" placeholder="Search, or 55:13" bind:value={query} aria-label="Search surahs, or type a verse like 55:13" onkeydown={(e) => { if (e.key === 'Enter' && ref) { go(ref.ch.id, ref.verse); query = ''; } }} />
    </label>
    {#if ref}
      <button class="go" onclick={() => { go(ref.ch.id, ref.verse); query = ''; }}>Go to {ref.ch.name_simple} {ref.ch.id}:{ref.verse}</button>
    {/if}
    <ul bind:this={list}>
      {#each shown as c (c.id)}
        <li>
          <button class:on={c.id === player.chapter} class:ctx={menu?.id === c.id} onclick={() => { ui.closeSettings(); player.load(c.id, player.playing); }} oncontextmenu={(e) => openMenu(e, c.id)}>
            <span class="num">{c.id}</span>
            <span class="names">
              <b>{settings.arabicNames ? c.name_arabic : c.name_simple}</b>
              <small>{c.translated_name.name} · {c.verses_count}</small>
            </span>
            {#if player.isChapterDownloaded(c.id)}<i class="dl" title="Downloaded for offline"></i>{/if}
            <span class="ar">{settings.arabicNames ? c.name_simple : c.name_arabic}</span>
          </button>
        </li>
      {/each}
    </ul>
    {/if}
  </div>
</aside>

<svelte:window onpointerdown={(e) => menu && !(e.target as HTMLElement).closest('.cm') && closeMenu()} onresize={closeMenu} onblur={closeMenu} />

{#if menu && target}
  <div class="cm" bind:this={menuEl} style:left="{menu.x}px" style:top="{menu.y}px" role="menu" aria-label="{target.name_simple} options" tabindex="-1" onkeydown={menuKey}>
    <header><b>{nameOf(target)}</b><small>{target.id} · {target.verses_count} verses</small></header>
    <button role="menuitem" onclick={read}>
      <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.2C8.4 4.2 5.6 3.8 2.8 4.4v10.8c2.8-.6 5.6-.2 7.2.8 1.6-1 4.4-1.4 7.2-.8V4.4c-2.8-.6-5.6-.2-7.2.8zM10 5.2V16" /></svg>Read
    </button>
    <button role="menuitem" onclick={listen}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path d="M7.5 4.6v14.8a.8.8 0 0 0 1.22.68l12-7.4a.8.8 0 0 0 0-1.36l-12-7.4a.8.8 0 0 0-1.22.68z" fill="currentColor" /></svg>Listen<em>{reciterName}</em>
    </button>
    {#if savedAudio}
      <button role="menuitem" onclick={removeAudio}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="m7.6 12.3 3.3 3.2 5.6-6.4" fill="none" stroke="var(--panel)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>Saved offline<em>Remove</em>
      </button>
    {:else if fetchingAudio}
      <button role="menuitem" disabled>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></svg>Downloading<em>{fetchPct === null ? '…' : `${fetchPct}%`}</em>
      </button>
    {:else}
      <button role="menuitem" onclick={saveAudio} disabled={player.dl.running}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></svg>Download audio
      </button>
    {/if}
    <button role="menuitem" onclick={copyName}>
      <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="9" height="9" rx="2" /><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></svg>Copy name
    </button>
  </div>
{/if}

<style>
  aside { flex: none; width: 324px; overflow: hidden; background: var(--bg-2); z-index: 6; transition: transform 0.38s var(--ease), opacity 0.28s var(--ease); }
  /* Closed, it leaves the layout at once (the page reflows one time) and slides away; resizing it frame by
     frame made the page refit on every frame. */
  aside.closed { position: absolute; left: 0; top: 0; bottom: 0; transform: translateX(-100%); opacity: 0; pointer-events: none; }
  .inner { width: 324px; height: 100%; display: flex; flex-direction: column; min-height: 0; padding: 10px 12px 12px; }
  .search { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; padding: 0 12px; height: 38px; border-radius: 10px; background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--ink-dim); }
  .search:focus-within { background: color-mix(in srgb, var(--ink) 10%, transparent); box-shadow: 0 0 0 2px var(--accent-soft); }
  input { flex: 1; min-width: 0; background: none; border: 0; outline: 0; color: var(--ink); font: inherit; font-size: 14px; user-select: text; }
  input::placeholder { color: var(--ink-faint); }
  ul { list-style: none; padding: 0 0 8px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 2px; }
  li button { width: 100%; display: flex; align-items: center; gap: 14px; padding: 11px 12px; border-radius: 10px; text-align: left; transition: background-color 0.12s; }
  li button:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); }
  li button.on { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .num { width: 28px; flex: none; text-align: center; font-size: 13px; color: var(--ink-dim); font-variant-numeric: tabular-nums; }
  .on .num { color: var(--accent); font-weight: 600; }
  .names { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  b { font-weight: 600; font-size: 14.5px; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  small { color: var(--ink-dim); font-size: 12.5px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ar { font-family: var(--ar-ui, 'Amiri Quran'), serif; font-size: 22px; line-height: 1.2; color: var(--ink-dim); }
  .on .ar { color: var(--accent); }
  .dl { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex: none; }
  .tabs { display: flex; margin: 0 0 12px; background: var(--btn); border: 1px solid var(--btn-line); border-radius: 12px; padding: 3px; }
  .tabs button { flex: 1; height: 32px; border-radius: 8px; font-size: 13.5px; font-weight: 600; color: var(--ink-dim); display: flex; align-items: center; justify-content: center; gap: 7px; transition: background-color 0.2s, color 0.2s; }
  .tabs button:hover { color: var(--ink); }
  .tabs button[aria-selected='true'] { background: var(--sel); color: var(--accent); }
  .count { font-size: 11.5px; background: var(--accent-soft); color: var(--accent); border-radius: 999px; padding: 0 7px; font-variant-numeric: tabular-nums; }
  .go { margin: 0 0 12px; height: 36px; border-radius: 10px; background: var(--accent); color: var(--accent-ink); font-weight: 600; font-size: 13.5px; }
  .marks li { display: flex; align-items: center; gap: 2px; }
  .marks .mark { flex: 1; min-width: 0; align-items: flex-start; }
  .mark svg { color: var(--accent); flex: none; margin-top: 3px; }
  .mark small { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .rm { width: 32px; height: 32px; border-radius: 8px; color: var(--ink-faint); display: grid; place-items: center; flex: none; }
  .rm:hover { background: color-mix(in srgb, var(--ink) 9%, transparent); color: var(--ink); }
  /* `.marks li` is a row; the empty state is a centred column and must win over it */
  .marks li.empty { flex: 1; flex-direction: column; justify-content: center; align-items: center; gap: 10px; padding: 0 20px 60px; text-align: center; color: var(--ink-dim); }
  .empty svg { color: var(--ink-faint); }
  .empty p { font-size: 15px; font-weight: 600; color: var(--ink); }
  .empty small { display: block; max-width: 24ch; font-size: 13px; line-height: 1.55; white-space: normal; overflow: visible; }
  li button.ctx { background: color-mix(in srgb, var(--ink) 9%, transparent); }

  .cm { position: fixed; z-index: 90; width: 248px; padding: 6px; display: flex; flex-direction: column; gap: 1px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 18px 44px -14px #000b; animation: cm 0.14s var(--ease); }
  @keyframes cm { from { opacity: 0; transform: translateY(-4px) scale(0.98); } }
  .cm header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 8px 10px 8px; margin-bottom: 4px; border-bottom: 1px solid var(--line); }
  .cm header b { font-size: 14px; font-weight: 600; }
  .cm header small { color: var(--ink-dim); font-size: 11.5px; white-space: nowrap; }
  .cm button { width: 100%; display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 8px; font-size: 13.5px; font-weight: 500; text-align: left; color: var(--ink); }
  .cm button:hover:not(:disabled), .cm button:focus-visible { background: color-mix(in srgb, var(--ink) 10%, transparent); outline: 0; }
  .cm button:disabled { opacity: 0.55; }
  .cm button svg { flex: none; color: var(--ink-dim); }
  .cm button em { margin-left: auto; padding-left: 8px; font-style: normal; font-weight: 400; font-size: 12px; color: var(--ink-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 110px; }
</style>
