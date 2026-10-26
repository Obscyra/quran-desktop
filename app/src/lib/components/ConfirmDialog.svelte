<script lang="ts">
  import { tick } from 'svelte';
  import { confirm } from '$lib/confirm.svelte';

  const ask = $derived(confirm.current);
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

<style>
  .scrim { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; background: #0008; animation: fade 0.18s; }
  @keyframes fade { from { opacity: 0; } }
  .dlg { width: min(420px, calc((100vw - 32px) / var(--zoom, 1))); padding: 22px 22px 18px; border-radius: 16px; background: var(--panel); border: 1px solid var(--line); box-shadow: 0 24px 60px -16px #000c; animation: pop 0.22s var(--ease); }
  @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } }
  .n { font-size: 11.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 6px; }
  h3 { font-size: 17px; font-weight: 600; }
  #cf-b { margin-top: 8px; color: var(--ink-dim); font-size: 14px; line-height: 1.6; }
  .acts { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
  .acts button { height: 36px; padding: 0 18px; border-radius: 9px; font-weight: 550; font-size: 13.5px; }
  .cancel { background: color-mix(in srgb, var(--ink) 10%, transparent); }
  .cancel:hover { background: color-mix(in srgb, var(--ink) 16%, transparent); }
  .ok { background: var(--accent); color: var(--accent-ink); }
  .ok.danger { background: #c4372c; color: #fff; }
  .ok:hover { opacity: 0.92; }
</style>
