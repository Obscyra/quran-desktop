<script lang="ts">
  import { tick } from 'svelte';
  import { confirm } from '$lib/confirm.svelte';
  import { ui } from '$lib/ui.svelte';

  const ask = $derived(confirm.current);
  const networkFailure = $derived(ui.networkFailure);
  const step = $derived(ask ? ask.steps[confirm.step] : null);
  let cancelBtn = $state<HTMLButtonElement>();

  // focus lands on the safe choice each time a step appears
  $effect(() => {
    confirm.step;
    if (ask) tick().then(() => cancelBtn?.focus());
  });
  function key(e: KeyboardEvent) {
    if (!ask) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      confirm.cancel();
    }
  }
</script>

<svelte:window onkeydowncapture={key} />

{#if ask && step}
  <div class="scrim" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && confirm.cancel()}>
    <div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-b">
      {#if ask.steps.length > 1}<p class="n">Step {confirm.step + 1} of {ask.steps.length}</p>{/if}
      <h3 id="cf-t">{step.title}</h3>
      <p id="cf-b">{step.body}</p>
      <div class="acts">
        <button bind:this={cancelBtn} class="cancel" onclick={() => confirm.cancel()}>Cancel</button>
        <button class="ok" class:danger={ask.danger} onclick={() => confirm.accept()}>{step.ok}</button>
      </div>
    </div>
  </div>
{/if}

{#if networkFailure}
  <div class="scrim" role="presentation">
    <div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="net-title" aria-describedby="net-body">
      <h3 id="net-title">Could not load {networkFailure.resource}</h3>
      <p id="net-body">The request failed or timed out. Check your connection and retry.</p>
      <div class="acts">
        <button class="cancel" onclick={() => (ui.networkFailure = null)}>Dismiss</button>
        <button class="ok" onclick={() => { const retry = networkFailure?.retry; ui.networkFailure = null; retry?.(); }}>Retry</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .scrim { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; background: color-mix(in oklab, var(--bg) 60%, transparent); backdrop-filter: blur(6px); animation: fade 0.18s; }
  @keyframes fade { from { opacity: 0; } }
  .dlg { width: min(420px, calc((100vw - 32px) / var(--zoom, 1))); padding: 22px 22px 18px; border-radius: var(--r-lg); background: var(--chrome); border: 1px solid var(--hair); box-shadow: var(--e3); animation: pop 0.22s var(--ease); }
  @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } }
  .n { font-size: var(--t-cap); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
  h3 { font-size: var(--t-title); font-weight: 600; letter-spacing: -0.01em; }
  #cf-b { margin-top: 8px; color: var(--muted); font-size: var(--t-body); line-height: 1.6; }
  .acts { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
  .acts button { height: 32px; padding: 0 14px; border-radius: var(--r-md); font-weight: 600; font-size: var(--t-body); transition: background-color 0.15s, opacity 0.2s; }
  .cancel { background: var(--ink-6); color: var(--ink); }
  .cancel:hover { background: var(--btn-hover); }
  .ok { background: var(--accent); color: var(--accent-ink); }
  .ok.danger { background: color-mix(in oklab, var(--danger) 12%, transparent); color: var(--danger); }
  .ok.danger:hover { background: color-mix(in oklab, var(--danger) 20%, transparent); opacity: 1; }
  .ok:hover { opacity: 0.92; }
</style>
