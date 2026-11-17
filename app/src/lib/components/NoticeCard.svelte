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

{#if n}
  <aside class="notice" class:verse={n.kind === 'verse'} role="status" aria-live="polite">
    <header>
      <b>{n.title}</b>
      <button class="x" onclick={close} aria-label="Dismiss">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
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
  .notice { position: fixed; right: 16px; bottom: 16px; width: min(380px, calc((100vw - 32px) / var(--zoom, 1))); padding: 14px 16px 14px; border-radius: var(--r-lg); background: var(--chrome); border: 1px solid var(--hair); box-shadow: var(--e2); max-height: calc((100vh - 32px) / var(--zoom, 1)); z-index: 60; animation: up 0.4s var(--ease); display: flex; flex-direction: column; gap: 8px; }
  @keyframes up { from { transform: translateY(14px); opacity: 0; } }
  .scroll { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; overscroll-behavior: contain; padding-right: 4px; }
  header { flex: none; display: flex; align-items: center; gap: 8px; }
  header b { flex: 1; font-size: var(--t-meta); font-weight: 600; color: var(--accent); letter-spacing: 0.02em; }
  .x { width: 24px; height: 24px; border-radius: var(--r-sm); display: grid; place-items: center; color: var(--muted); }
  .x:hover { background: var(--ink-6); color: var(--ink); }
  .ar { font-family: 'KFGQPC Uthmanic Hafs', serif; font-size: 26px; line-height: 1.9; text-align: right; user-select: text; }
  .body { font-size: var(--t-body); line-height: 1.6; color: var(--muted); user-select: text; }
  .notice:not(.verse) .body { color: var(--ink); font-size: var(--t-body); }
  .acts { flex: none; display: flex; gap: 8px; margin-top: 2px; }
  .acts button { height: 32px; padding: 0 14px; border-radius: var(--r-md); font-size: var(--t-meta); font-weight: 600; background: var(--ink-6); }
  .acts button:hover { background: var(--btn-hover); }
  .acts .go { background: var(--accent); color: var(--accent-ink); }
  .acts .go:hover { background: var(--accent); opacity: 0.92; }
</style>
