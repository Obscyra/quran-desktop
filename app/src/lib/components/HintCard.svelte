<script lang="ts">
  import { hints } from '$lib/hints.svelte';
  import { ui } from '$lib/ui.svelte';

  const h = $derived(hints.current);
  let hovered = false;
  let timer = 0;
  // left alone, the card goes away by itself; it stays while the pointer rests on it
  $effect(() => {
    clearTimeout(timer);
    if (!h) return;
    const wait = () => {
      timer = window.setTimeout(() => (hovered ? wait() : hints.close()), hints.changed ? 6000 : 16000);
    };
    wait();
    return () => clearTimeout(timer);
  });
</script>

{#if h}
  <aside class="hint" class:above={ui.listening} role="status" aria-live="polite" onpointerenter={() => (hovered = true)} onpointerleave={() => (hovered = false)}>
    <header>
      <b>{h.title}</b>
      <button class="x" onclick={() => hints.close()} aria-label="Dismiss">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </button>
    </header>
    <p>{h.body}</p>
    {#if h.label && h.on}
      <div class="row">
        <span>{h.label}</span>
        <button class="toggle" class:on={h.on()} role="switch" aria-checked={h.on()} aria-label={h.label} onclick={() => hints.toggle()}><i></i></button>
      </div>
    {/if}
    <div class="acts">
      {#if hints.changed}
        <button class="go" onclick={() => hints.close()}>Done</button>
      {:else}
        <button onclick={() => hints.close()}>Not now</button>
        <button onclick={() => hints.never()}>Don't show again</button>
      {/if}
      <button class="link" onclick={() => hints.openSettings()}>{h.link ?? 'In Settings'}</button>
    </div>
  </aside>
{/if}

<style>
  .hint { position: fixed; right: 16px; bottom: 16px; width: min(360px, calc((100vw - 32px) / var(--zoom, 1))); padding: 14px 16px; border-radius: var(--r-lg); background: var(--chrome); border: 1px solid var(--hair); box-shadow: var(--e2); z-index: 59; animation: up 0.4s var(--ease); display: flex; flex-direction: column; gap: 10px; }
  .hint.above { bottom: 92px; }
  @keyframes up { from { transform: translateY(14px); opacity: 0; } }
  header { display: flex; align-items: center; gap: 8px; }
  header b { flex: 1; font-size: var(--t-body); font-weight: 600; color: var(--accent); }
  .x { width: 24px; height: 24px; border-radius: var(--r-sm); display: grid; place-items: center; color: var(--muted); }
  .x:hover { background: var(--ink-6); color: var(--ink); }
  p { font-size: var(--t-body); line-height: 1.55; color: var(--muted); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px; border-radius: var(--r-md); background: var(--ink-6); font-size: var(--t-body); font-weight: 550; }
  .toggle { width: 36px; height: 20px; border-radius: var(--r-pill); background: var(--ink-6); box-shadow: inset 0 0 0 1px var(--hair); position: relative; transition: background 0.25s; flex: none; }
  .toggle i { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--ink); box-shadow: var(--e1); transition: transform 0.25s var(--ease); }
  .toggle.on { background: var(--accent); }
  .toggle.on i { transform: translateX(16px); background: var(--accent-ink); }
  .acts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .acts button { height: 32px; padding: 0 14px; border-radius: var(--r-md); font-size: var(--t-meta); font-weight: 600; background: var(--ink-6); }
  .acts button:hover { background: var(--btn-hover); }
  .acts .go { background: var(--accent); color: var(--accent-ink); }
  .acts .link { margin-left: auto; background: none; color: var(--accent); padding: 0 4px; }
  .acts .link:hover { background: none; text-decoration: underline; }
</style>
