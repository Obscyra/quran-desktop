<script lang="ts">
  import { closePick, copyVerse, toggleBookmark } from '$lib/actions';
  import { bookmarks } from '$lib/bookmarks.svelte';
  import { player } from '$lib/player.svelte';
  import { settings } from '$lib/settings.svelte';
  import { ui } from '$lib/ui.svelte';

  const pick = $derived(ui.pick);
  // the verse data is the one on screen: a pick in another chapter has none here, so no menu for it
  const verse = $derived(pick && pick.chapter === player.chapter ? player.verses.find((v) => v.n === pick.verse) : undefined);
  const word = $derived(pick && pick.pos > 0 ? verse?.words.find((w) => w.pos === pick.pos) : undefined);
  const saved = $derived(pick ? bookmarks.get(pick.chapter, pick.verse) : undefined);
  const looping = $derived(pick ? player.loopVerse === pick.verse : false);

  let box = $state<HTMLElement>();
  let h = $state(0);
  let pos = $state({ x: 0, y: 0, below: false });
  let copied = $state(false);

  function place() {
    if (!pick) return;
    const el = document.getElementById(pick.pos > 0 ? `w-${pick.chapter}-${pick.verse}-${pick.pos}` : `end-${pick.chapter}-${pick.verse}`);
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
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3" /></svg>Play verse
      </button>
      <button onclick={() => { player.playFrom(pick.verse, pick.pos || 1); closePick(); }}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" x2="19" y1="5" y2="19" /></svg>Play from {pick.pos ? 'this word' : 'here'}
      </button>
      <button class:on={looping} onclick={() => { if (looping) player.stop(); else player.playVerse(pick.verse, true); closePick(); }}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>{looping ? 'Stop repeating' : 'Repeat verse'}
      </button>
      <button class:on={!!saved} onclick={() => toggleBookmark(pick.verse)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill={saved ? "currentColor" : "none"} stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>{saved ? 'Bookmarked' : 'Bookmark'}
      </button>
      <button onclick={copy}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>{copied ? 'Copied' : 'Copy verse'}
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
    background: var(--chrome); color: var(--ink); border: 1px solid var(--hair); border-radius: var(--r-lg);
    box-shadow: var(--e2); padding: 6px; animation: pop 0.16s var(--ease);
  }
  .menu.below { translate: 0 0; }
  @keyframes pop { from { opacity: 0; scale: 0.96; } }
  .meaning { padding: 8px 10px 4px; display: flex; flex-direction: column; gap: 2px; }
  .meaning b { font-size: 16px; font-weight: 600; color: var(--accent); user-select: text; }
  .meaning small { color: var(--muted); font-size: var(--t-meta); font-style: italic; user-select: text; }
  .ref { padding: 2px 10px 8px; color: var(--ink-faint); font-size: var(--t-meta); letter-spacing: 0.02em; border-bottom: 1px solid var(--hair); margin: 0 4px 6px; }
  .acts { display: flex; flex-direction: column; }
  .acts button { display: flex; align-items: center; gap: 12px; height: 34px; padding: 0 10px; border-radius: var(--r-md); font-size: var(--t-body); text-align: left; color: var(--ink); transition: background-color 0.12s; }
  .acts button:hover { background: var(--ink-6); }
  .acts button.on { color: var(--accent); }
  .acts svg { color: var(--muted); flex: none; }
  .acts button.on svg { color: var(--accent); }
  .note { width: calc(100% - 12px); margin: 4px 6px 6px; height: 34px; padding: 0 10px; border-radius: var(--r-md); border: 1px solid var(--hair); background: color-mix(in oklab, var(--ink) 5%, transparent); color: var(--ink); font: inherit; font-size: var(--t-body); user-select: text; }
  .note:focus { outline: 2px solid var(--accent); outline-offset: 0; }
</style>
