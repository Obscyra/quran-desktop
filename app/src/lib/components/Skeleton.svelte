<script lang="ts">
  // One loading placeholder. A single block (w, h, circle), or `lines` rows of text-like bars when `label` is given
  // the wrapper is announced to screen readers as busy, with the label hidden from sight.
  let {
    w = '100%',
    h = '1em',
    circle = false,
    lines = 0,
    label = '',
    widths = [],
    gap = '0.7em',
    align = 'start'
  }: { w?: string; h?: string; circle?: boolean; lines?: number; label?: string; widths?: string[]; gap?: string; align?: 'start' | 'end' | 'center' } = $props();
</script>

{#if lines > 0 || label}
  <div class="sk-stack" role="status" aria-busy="true" style:gap style:align-items={align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center'}>
    {#if label}<span class="sk-sr">{label}</span>{/if}
    {#each { length: lines } as _, i}
      <i class="sk" style:width={widths[i % (widths.length || 1)] ?? (i === lines - 1 && lines > 1 ? '60%' : w)} style:height={h} aria-hidden="true"></i>
    {/each}
  </div>
{:else}
  <i class="sk" class:circle style:width={circle ? h : w} style:height={h} aria-hidden="true"></i>
{/if}

<style>
  .sk-stack { display: flex; flex-direction: column; width: 100%; }
  .sk-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
