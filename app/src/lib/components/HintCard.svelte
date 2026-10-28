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

{#if h && !ui.focus}
  <aside class="hint" class:above={ui.listening} role="status" aria-live="polite" onpointerenter={() => (hovered = true)} onpointerleave={() => (hovered = false)}>
    <header>
      <b>{h.title}</b>
      <button class="x" onclick={() => hints.close()} aria-label="Dismiss">
        <svg aria-hidden="true" viewBox="0 0 10 10" width="10" height="10"><path d="M.5.5l9 9M9.5.5l-9 9" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
      </button>
    </header>
    <p>{h.body}</p>
    <div class="row">
      <span>{h.label}</span>
      <button class="toggle" class:on={h.on()} role="switch" aria-checked={h.on()} aria-label={h.label} onclick={() => hints.toggle()}><i></i></button>
    </div>
    <div class="acts">
      {#if hints.changed}
        <button class="go" onclick={() => hints.close()}>Done</button>
      {:else}
        <button onclick={() => hints.close()}>Not now</button>
        <button onclick={() => hints.never()}>Don't show again</button>
      {/if}
      <button class="link" onclick={() => hints.openSettings()}>In Settings</button>
    </div>
  </aside>
{/if}

<style>
  .hint { position: fixed; right: 16px; bottom: 16px; width: min(360px, calc((100vw - 32px) / var(--zoom, 1))); padding: 14px 16px; border-radius: 14px; background: var(--panel); border: 1px solid var(--line); box-shadow: 0 18px 44px -14px #000b; z-index: 59; animation: up 0.4s var(--ease); display: flex; flex-direction: column; gap: 10px; }
  .hint.above { bottom: 92px; }
  @keyframes up { from { transform: translateY(14px); opacity: 0; } }
  header { display: flex; align-items: center; gap: 8px; }
  header b { flex: 1; font-size: 13.5px; font-weight: 600; color: var(--accent); }
  .x { width: 24px; height: 24px; border-radius: 6px; display: grid; place-items: center; color: var(--ink-dim); }
  .x:hover { background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink); }
  p { font-size: 13px; line-height: 1.55; color: var(--ink-dim); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px; border-radius: 10px; background: color-mix(in srgb, var(--ink) 6%, transparent); font-size: 13px; font-weight: 550; }
  .toggle { width: 42px; height: 24px; border-radius: 999px; background: var(--line); position: relative; transition: background 0.25s; flex: none; }
  .toggle i { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--ink); transition: transform 0.25s var(--ease); }
  .toggle.on { background: var(--accent); }
  .toggle.on i { transform: translateX(18px); background: var(--accent-ink); }
  .acts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .acts button { height: 28px; padding: 0 12px; border-radius: 8px; font-size: 12.5px; font-weight: 550; background: color-mix(in srgb, var(--ink) 9%, transparent); }
  .acts button:hover { background: color-mix(in srgb, var(--ink) 15%, transparent); }
  .acts .go { background: var(--accent); color: var(--accent-ink); }
  .acts .link { margin-left: auto; background: none; color: var(--accent); padding: 0 4px; }
  .acts .link:hover { background: none; text-decoration: underline; }
</style>
