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
      <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="7" y="7" width="9.5" height="9.5" rx="2" /><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></svg>{done ? 'Copied' : 'Copy'}
    </button>
  </div>
{/if}

<style>
  .copymenu { position: fixed; z-index: 70; min-width: 110px; padding: 4px; background: var(--panel); color: var(--ink); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 14px 34px -12px #000b; animation: pop 0.14s var(--ease); }
  @keyframes pop { from { opacity: 0; scale: 0.96; } }
  button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 12px; border-radius: 7px; font-size: 13px; text-align: left; color: var(--ink); }
  button:hover { background: color-mix(in srgb, var(--ink) 9%, transparent); }
  svg { color: var(--ink-dim); }
</style>
