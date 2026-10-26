<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { player } from '$lib/player.svelte';
  import { settings } from '$lib/settings.svelte';
  import { ui } from '$lib/ui.svelte';

  /** the listening bar is closed, so say how to open it */
  const show = $derived(!ui.listening && settings.listenBar !== 'always' && !ui.settingsOpen && !ui.focus && !!player.current);
  const name = $derived(settings.arabicNames ? player.current?.name_arabic : player.current?.name_simple);
</script>

{#if show}
  <button class="pill" onclick={() => player.toggle()} transition:fly={{ y: 14, duration: 260, easing: cubicOut }} title="Play the recitation (L shows the player without playing)" aria-label="Listen to {player.current?.name_simple}">
    <span class="dot"><svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>
    <span class="txt">Listen<i>{name}</i></span>
  </button>
{/if}

<style>
  .pill { position: absolute; right: 24px; bottom: 22px; z-index: 40; display: inline-flex; align-items: center; gap: 10px; height: 46px; padding: 0 20px 0 7px; border-radius: 999px; background: var(--panel); color: var(--ink); border: 1px solid var(--line); box-shadow: 0 14px 34px -12px #000c; font-weight: 600; font-size: 14px; transition: transform 0.15s var(--ease), border-color 0.15s, background-color 0.15s; }
  .pill:hover { border-color: var(--accent); }
  .pill:active { transform: scale(0.97); }
  .dot { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: var(--accent-ink); }
  .dot svg { margin-left: 2px; }
  .txt { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.15; }
  .txt i { font-style: normal; font-weight: 400; font-size: 11.5px; color: var(--ink-dim); }
</style>
