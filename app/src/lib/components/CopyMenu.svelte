<script lang="ts">
  // Right-click on selected text: one item, Copy. (Anywhere else the browser's own menu is switched off.)
  let at = $state<{ x: number; y: number; text: string } | null>(null);
  let done = $state(false);

  /** `true` when the menu took the event (there is selected text to copy) */
  export function show(e: MouseEvent): boolean {
    const text = window.getSelection()?.toString().trim() ?? '';
    if (!text) return false;
    const z = Number(document.documentElement.style.getPropertyValue('--zoom')) || 1;
    // the interface may be zoomed: the menu sits inside it, so positions are in its own units
    at = { x: Math.min(e.clientX, innerWidth - 120) / z, y: Math.min(e.clientY, innerHeight - 50) / z, text };
    done = false;
    return true;
  }
  const close = () => (at = null);
  async function copy() {
    if (!at) return;
    try {
      await navigator.clipboard.writeText(at.text);
    } catch {
      document.execCommand('copy');
    }
    done = true;
    setTimeout(close, 500);
  }
</script>

<svelte:window onpointerdown={(e) => !(e.target as HTMLElement).closest('.copymenu') && close()} onkeydown={(e) => e.key === 'Escape' && close()} onblur={close} />

{#if at}
  <div class="copymenu" style:left="{at.x}px" style:top="{at.y}px" role="menu">
    <button role="menuitem" onclick={copy}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>{done ? 'Copied' : 'Copy'}
    </button>
  </div>
{/if}

<style>
  .copymenu { position: fixed; z-index: 70; min-width: 120px; padding: 6px; background: var(--chrome); color: var(--ink); border: 1px solid var(--hair); border-radius: var(--r-lg); box-shadow: var(--e2); animation: pop 0.14s var(--ease); }
  @keyframes pop { from { opacity: 0; scale: 0.96; } }
  button { display: flex; align-items: center; gap: 12px; width: 100%; height: 34px; padding: 0 10px; border-radius: var(--r-md); font-size: var(--t-body); text-align: left; color: var(--ink); }
  button:hover { background: var(--ink-6); }
  svg { color: var(--muted); flex: none; }
</style>
