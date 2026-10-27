<script lang="ts">
  import { PHOTO_BASE } from '$lib/reciters';
  import type { Reciter } from '$lib/types';

  let { r, size = 44 }: { r?: Reciter; size?: number } = $props();

  // portraits ship with the app (static/reciters); the quran.com copy is the fallback, then the initials
  let stage = $state(0);
  const file = $derived(r?.photo ? (r.photo.split('/').pop() ?? '').replace(/\.[a-z]+$/i, '') : '');
  const src = $derived(stage === 0 ? `/reciters/${file}.webp` : PHOTO_BASE + r?.photo);
  const initials = $derived((r?.name ?? '?').split(/\s+/).filter((x) => /^\p{L}/u.test(x)).slice(0, 2).map((x) => x[0]).join('').toUpperCase());
  $effect(() => {
    r?.photo;
    stage = 0;
  });
</script>

<span class="qari" style:width="{size}px" style:height="{size}px" style:font-size="{size * 0.36}px">
  {#if r?.photo && stage < 2}
    <img {src} alt="" loading="lazy" decoding="async" draggable="false" onerror={() => stage++} />
  {:else}{initials}{/if}
</span>

<style>
  .qari { flex: none; display: inline-grid; place-items: center; border-radius: 50%; overflow: hidden; background: var(--accent-soft); color: var(--accent); font-weight: 650; box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink) 14%, transparent); }
  img { width: 100%; height: 100%; object-fit: cover; object-position: center 20%; display: block; }
</style>
