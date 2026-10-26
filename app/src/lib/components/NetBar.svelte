<script lang="ts">
  import { fade } from 'svelte/transition';
  import { player } from '$lib/player.svelte';
  import { ui } from '$lib/ui.svelte';

  // Loading that is over in a moment is not worth showing; one that drags on is, and later gets a word of explanation.
  let shown = $state(false);
  let slow = $state(false);
  $effect(() => {
    if (!player.busy) {
      shown = false;
      slow = false;
      return;
    }
    const a = setTimeout(() => (shown = true), 350);
    const b = setTimeout(() => (slow = true), 6000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  });
  const what = $derived(player.loadingAudio && !player.loading ? 'the recitation' : 'the surah');
</script>

{#if shown && !ui.settingsOpen}
  <div class="net" transition:fade={{ duration: 220 }} role="status" aria-live="polite">
    <i class="line" aria-hidden="true"></i>
    <span class="pill">
      <i class="ring" aria-hidden="true"></i>
      {slow ? `Still loading ${what}. The connection looks slow…` : `Loading ${what}…`}
    </span>
  </div>
{/if}

<style>
  .net { position: absolute; top: 40px; left: 0; right: 0; z-index: 35; pointer-events: none; display: flex; justify-content: center; }
  .line { position: absolute; top: 0; left: 0; right: 0; height: 2px; overflow: hidden; background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .line::after { content: ''; position: absolute; inset: 0; width: 40%; background: var(--accent); border-radius: 2px; animation: slide 1.15s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
  @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
  .pill { margin-top: 58px; display: inline-flex; align-items: center; gap: 9px; height: 30px; padding: 0 14px 0 11px; border-radius: 999px; background: var(--panel); border: 1px solid var(--line); box-shadow: 0 10px 26px -12px #000b; color: var(--ink-dim); font-size: 12.5px; font-weight: 500; }
  .ring { width: 13px; height: 13px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--accent) 28%, transparent); border-top-color: var(--accent); animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
