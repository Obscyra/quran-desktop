<script lang="ts">
  import { player } from '$lib/player.svelte';
  import { settings } from '$lib/settings.svelte';
  import { ui } from '$lib/ui.svelte';

  const n = $derived(ui.notice);
  let timer = 0;
  $effect(() => {
    clearTimeout(timer);
    if (n) timer = window.setTimeout(() => (ui.notice = null), n.kind === 'verse' ? 90000 : n.kind === 'info' ? 7000 : 30000);
    return () => clearTimeout(timer);
  });

  const close = () => (ui.notice = null);
  async function read(listen: boolean) {
    const x = ui.notice;
    close();
    if (!x?.chapter || !x.verse) return;
    // the verse of the day is shown verse by verse, with its translation
    settings.mode = 'verse';
    ui.closeSettings();
    await player.goTo(x.chapter, x.verse);
    if (listen) player.playVerse(x.verse);
  }
</script>

{#if n && !ui.focus}
  <aside class="notice" class:verse={n.kind === 'verse'} role="status" aria-live="polite">
    <header>
      <b>{n.title}</b>
      <button class="x" onclick={close} aria-label="Dismiss">
        <svg aria-hidden="true" viewBox="0 0 10 10" width="10" height="10"><path d="M.5.5l9 9M9.5.5l-9 9" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
      </button>
    </header>
    <div class="scroll">
      {#if n.arabic}<p class="ar" dir="rtl" lang="ar">{n.arabic}</p>{/if}
      {#if n.body}<p class="body">{n.body}</p>{/if}
    </div>
    {#if n.chapter}
      <div class="acts">
        <button class="go" onclick={() => read(false)}>Read</button>
        <button onclick={() => read(true)}>Listen</button>
      </div>
    {/if}
  </aside>
{/if}

<style>
  .notice { position: fixed; right: 16px; bottom: 16px; width: min(380px, calc((100vw - 32px) / var(--zoom, 1))); padding: 14px 16px 14px; border-radius: 14px; background: var(--panel); border: 1px solid var(--line); box-shadow: 0 18px 44px -14px #000b; max-height: calc((100vh - 32px) / var(--zoom, 1)); z-index: 60; animation: up 0.4s var(--ease); display: flex; flex-direction: column; gap: 8px; }
  @keyframes up { from { transform: translateY(14px); opacity: 0; } }
  .scroll { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; overscroll-behavior: contain; padding-right: 4px; }
  header { flex: none; display: flex; align-items: center; gap: 8px; }
  header b { flex: 1; font-size: 12.5px; font-weight: 600; color: var(--accent); letter-spacing: 0.02em; }
  .x { width: 24px; height: 24px; border-radius: 6px; display: grid; place-items: center; color: var(--ink-dim); }
  .x:hover { background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink); }
  .ar { font-family: 'KFGQPC Uthmanic Hafs', serif; font-size: 26px; line-height: 1.9; text-align: right; user-select: text; }
  .body { font-size: 13.5px; line-height: 1.6; color: var(--ink-dim); user-select: text; }
  .notice:not(.verse) .body { color: var(--ink); font-size: 14.5px; }
  .acts { flex: none; display: flex; gap: 8px; margin-top: 2px; }
  .acts button { height: 30px; padding: 0 14px; border-radius: 8px; font-size: 12.5px; font-weight: 550; background: color-mix(in srgb, var(--ink) 9%, transparent); }
  .acts button:hover { background: color-mix(in srgb, var(--ink) 15%, transparent); }
  .acts .go { background: var(--accent); color: var(--accent-ink); }
  .acts .go:hover { background: var(--accent); opacity: 0.92; }
</style>
