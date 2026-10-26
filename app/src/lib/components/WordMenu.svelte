<script lang="ts">
  import { closePick, copyVerse, toggleBookmark } from '$lib/actions';
  import { bookmarks } from '$lib/bookmarks.svelte';
  import { player } from '$lib/player.svelte';
  import { settings } from '$lib/settings.svelte';
  import { ui } from '$lib/ui.svelte';

  const pick = $derived(ui.pick);
  const verse = $derived(pick ? player.verses.find((v) => v.n === pick.verse) : undefined);
  const word = $derived(pick && pick.pos > 0 ? verse?.words.find((w) => w.pos === pick.pos) : undefined);
  const saved = $derived(pick ? bookmarks.get(pick.chapter, pick.verse) : undefined);
  const looping = $derived(pick ? player.loopVerse === pick.verse : false);

  let box = $state<HTMLElement>();
  let h = $state(0);
  let pos = $state({ x: 0, y: 0, below: false });
  let copied = $state(false);

  function place() {
    if (!pick) return;
    const el = document.getElementById(pick.pos > 0 ? `w-${pick.verse}-${pick.pos}` : `end-${pick.verse}`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    // rects are in screen pixels, but this menu sits inside the (possibly scaled) interface
    const z = settings.uiScale;
    const W = 272 * z;
    const x = Math.min(Math.max(8, r.left + r.width / 2 - W / 2), innerWidth - W - 8);
    const below = r.top - h * z - 12 < 48 * z;
    pos = { x: x / z, y: (below ? r.bottom + 10 : r.top - 10) / z, below };
  }

  $effect(() => {
    pick;
    h;
    queueMicrotask(place);
  });

  function outside(e: PointerEvent) {
    if (!pick) return;
    const t = e.target as HTMLElement;
    if (box?.contains(t) || t.closest('.w, .end, .vn')) return;
    closePick();
  }
  async function copy() {
    if (!pick) return;
    copied = await copyVerse(pick.verse);
    setTimeout(() => (copied = false), 1400);
  }
</script>

<svelte:window onpointerdown={outside} onresize={place} onkeydown={(e) => e.key === 'Escape' && pick && closePick()} />
<svelte:document onscrollcapture={place} />

{#if pick && verse}
  <div
    class="menu"
    class:below={pos.below}
    bind:this={box}
    bind:clientHeight={h}
    style:left="{pos.x}px"
    style:top="{pos.y}px"
    role="dialog"
    aria-label="Verse {pick.chapter}:{pick.verse}"
  >
    {#if word}
      <div class="meaning">
        <b dir="auto">{word.translation || '—'}</b>
        {#if word.transliteration}<small>{word.transliteration}</small>{/if}
      </div>
    {/if}
    <p class="ref">{player.current?.name_simple} {pick.chapter}:{pick.verse}</p>
    <div class="acts">
      <button onclick={() => { player.playVerse(pick.verse); closePick(); }}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>Play verse
      </button>
      <button onclick={() => { player.playFrom(pick.verse, pick.pos || 1); closePick(); }}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><path d="M5 5v14l8-7zM13 5v14l8-7z" fill="currentColor" /></svg>Play from {pick.pos ? 'this word' : 'here'}
      </button>
      <button class:on={looping} onclick={() => { if (looping) player.stop(); else player.playVerse(pick.verse, true); closePick(); }}>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V8a3 3 0 0 1 3-3h8l-2-2M16 11v1a3 3 0 0 1-3 3H5l2 2" /></svg>{looping ? 'Stop repeating' : 'Repeat verse'}
      </button>
      <button class:on={!!saved} onclick={() => toggleBookmark(pick.verse)}>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M5.5 2.8h9v14.4L10 13.6l-4.5 3.6z" /></svg>{saved ? 'Bookmarked' : 'Bookmark'}
      </button>
      <button onclick={copy}>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="7" y="7" width="9.5" height="9.5" rx="2" /><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></svg>{copied ? 'Copied' : 'Copy verse'}
      </button>
    </div>
    {#if saved}
      <input class="note" type="text" placeholder="Add a note" value={saved.note} oninput={(e) => bookmarks.setNote(pick.chapter, pick.verse, e.currentTarget.value)} aria-label="Bookmark note" />
    {/if}
  </div>
{/if}

<style>
  .menu {
    position: fixed; z-index: 60; width: 272px; translate: 0 -100%;
    background: var(--panel); color: var(--ink); border: 1px solid var(--line); border-radius: 12px;
    box-shadow: 0 18px 44px -14px #000b; padding: 6px; animation: pop 0.16s var(--ease);
  }
  .menu.below { translate: 0 0; }
  @keyframes pop { from { opacity: 0; scale: 0.96; } }
  .meaning { padding: 8px 10px 4px; display: flex; flex-direction: column; gap: 2px; }
  .meaning b { font-size: 16px; font-weight: 600; color: var(--accent); user-select: text; }
  .meaning small { color: var(--ink-dim); font-size: 12.5px; user-select: text; }
  .ref { padding: 2px 10px 6px; color: var(--ink-faint); font-size: 11.5px; letter-spacing: 0.02em; border-bottom: 1px solid var(--line); margin-bottom: 4px; }
  .acts { display: flex; flex-direction: column; }
  .acts button { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; font-size: 13px; text-align: left; color: var(--ink); transition: background-color 0.12s; }
  .acts button:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); }
  .acts button.on { color: var(--accent); }
  .acts svg { color: var(--ink-dim); flex: none; }
  .acts button.on svg { color: var(--accent); }
  .note { width: calc(100% - 12px); margin: 4px 6px 6px; height: 30px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font: inherit; font-size: 13px; user-select: text; }
  .note:focus { outline: 2px solid var(--accent); outline-offset: 0; }
</style>
