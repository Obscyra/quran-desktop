<script lang="ts">
  import { pickVerse, sayVerse } from '$lib/actions';
  import { bookmarks } from '$lib/bookmarks.svelte';
  import { pageFonts } from '$lib/fonts.svelte';
  import { player } from '$lib/player.svelte';
  import { settings } from '$lib/settings.svelte';
  import { ui } from '$lib/ui.svelte';
  import type { Verse } from '$lib/types';

  let { v }: { v: Verse } = $props();

  const saved = $derived(settings.highlightBookmarks && bookmarks.has(player.chapter, v.n));
  const glyph = $derived(settings.script === 'mushaf' && !!v.endGlyph && pageFonts.has(v.endPage));
  const picked = $derived(ui.pick?.verse === v.n && ui.pick.pos === 0);
  const digits = $derived(v.n.toLocaleString('ar-EG'));
</script>

<button
  class="end"
  class:saved
  class:picked
  id="end-{v.n}"
  onclick={() => sayVerse(v.n)}
  oncontextmenu={(e) => {
    e.preventDefault();
    pickVerse(v.n);
  }}
  aria-label="Play verse {v.n}"
  title="Verse {v.n}: click to play, right-click for options"
>{#if glyph}<span class="g" style:font-family={pageFonts.family(v.endPage)}>{v.endGlyph}</span>{:else}<span class="ring">{digits}</span>{/if}</button>

<style>
  .end { display: inline-block; padding: 0 0.12em; border-radius: 8px; color: var(--accent); cursor: pointer; vertical-align: middle; transition: background-color 0.2s; }
  .end:hover, .end.picked { background: var(--accent-soft); }
  .g { font-size: var(--ar-size); line-height: var(--ar-lh); text-rendering: geometricPrecision; }
  .ring { display: inline-grid; place-items: center; min-width: 1.35em; height: 1.35em; padding: 0 0.15em; border-radius: 50%; border: 0.07em solid currentColor; font-family: 'KFGQPC Uthmanic Hafs', serif; font-size: calc(var(--ar-size) * 0.62); line-height: 1; }
  .end.saved { color: var(--ink); }
  .end.saved .ring { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
  .end.saved .g { color: var(--accent); }
</style>
