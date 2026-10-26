<script lang="ts">
  import { bookmarks } from '$lib/bookmarks.svelte';
  import { player } from '$lib/player.svelte';
  import { settings } from '$lib/settings.svelte';
  import { ui } from '$lib/ui.svelte';

  let query = $state('');
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
          <button class:on={c.id === player.chapter} onclick={() => { ui.closeSettings(); player.load(c.id, player.playing); }}>
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

<style>
  aside { flex: none; width: 324px; overflow: hidden; background: var(--bg-2); transition: width 0.34s var(--ease), opacity 0.25s; }
  aside.closed { width: 0; opacity: 0; }
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
  .tabs { display: flex; margin: 0 0 12px; background: color-mix(in srgb, var(--ink) 7%, transparent); border-radius: 10px; padding: 3px; }
  .tabs button { flex: 1; height: 32px; border-radius: 8px; font-size: 13.5px; font-weight: 550; color: var(--ink-dim); display: flex; align-items: center; justify-content: center; gap: 7px; transition: background-color 0.2s, color 0.2s; }
  .tabs button[aria-selected='true'] { background: var(--bg); color: var(--ink); box-shadow: 0 1px 2px #0003; }
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
</style>
