<script lang="ts">
  import { pickWord, sayWord } from '$lib/actions';
  import { pageFonts } from '$lib/fonts.svelte';
  import { reader } from '$lib/reader.svelte';
  import { settings } from '$lib/settings.svelte';
  import { ui } from '$lib/ui.svelte';
  import type { Verse, Word } from '$lib/types';

  let { v, w, below = false }: { v: Verse; w: Word; below?: boolean } = $props();

  const key = $derived(`${v.n}-${w.pos}`);
  const active = $derived(reader.activeKey === key);
  const selected = $derived(ui.pick?.verse === v.n && ui.pick.pos === w.pos);

  // one glyph per word, in the font of the page it was printed on; plain text until that font is in
  const glyph = $derived(settings.script === 'mushaf' && !!w.glyph && pageFonts.has(w.gp));
  const family = $derived(glyph ? pageFonts.family(w.gp) : settings.fontFamily);
  const tajweed = $derived(settings.script === 'tajweed');
  const text = $derived(
    glyph ? w.glyph : settings.script === 'indopak' ? (w.indo?.text ?? w.text) : w.text
  );

  const cache = new Map<string, string>();
  function tajweedHtml(src: string) {
    let out = cache.get(src);
    if (out === undefined) {
      out = src
        .replace(/<rule class=([a-z_]+)>/g, '\u0001$1\u0002')
        .replace(/<\/rule>/g, '\u0003')
        .replace(/[<>&]/g, '')
        .replace(/\u0001([a-z_]+)\u0002/g, '<span class="tj-$1">')
        .replace(/\u0003/g, '</span>');
      cache.set(src, out);
    }
    return out;
  }
</script>

<span
  class="w"
  class:active
  class:sel={selected}
  class:tj={tajweed}
  id="w-{v.n}-{w.pos}"
  title={settings.wordMeaning === 'hover' && !ui.pick ? w.translation : undefined}
  role="button"
  tabindex="-1"
  onclick={() => sayWord(v.n, w.pos)}
  oncontextmenu={(e) => {
    e.preventDefault();
    pickWord(v.n, w.pos);
  }}
  onkeydown={(e) => e.key === 'Enter' && sayWord(v.n, w.pos)}
><span class="t" class:g={glyph} style:font-family={family}>{#if tajweed}{@html tajweedHtml(w.taj)}{:else}{text}{/if}</span>{#if below}<span class="m">{w.translation}{#if settings.transliteration}<em>{w.transliteration}</em>{/if}</span>{/if}</span>

<style>
  .w { cursor: pointer; border-radius: 0.2em; padding: 0 0.03em; transition: color 0.2s, background-color 0.2s; display: inline-block; white-space: nowrap; }
  .t { font-size: var(--ar-size); line-height: var(--ar-lh); user-select: text; -webkit-user-select: text; display: inline-block; }
  .t.g { text-rendering: geometricPrecision; }
  .w:hover .t { color: var(--accent); }
  .w.sel { background: var(--accent-soft); box-shadow: 0 0 0 2px var(--accent-soft); }
  .w.sel .t { color: var(--accent); }
  /* the word being recited: the text fills with the accent from right to left as it is said */
  :global(.hl-sweep) .w.active { --p: 0; }
  :global(.hl-sweep) .w.active .t:not(.tj-host) {
    color: transparent;
    background: linear-gradient(to left, var(--accent) calc(var(--p) * 100%), var(--ink) calc(var(--p) * 100%));
    -webkit-background-clip: text;
    background-clip: text;
    filter: drop-shadow(0 0 0.16em color-mix(in srgb, var(--accent) 65%, transparent)) drop-shadow(0 0 0.04em var(--accent));
  }
  /* tajweed colours would vanish under a clipped gradient, so those words glow instead */
  :global(.hl-sweep) .w.tj.active .t { color: inherit; background: none; -webkit-background-clip: border-box; background-clip: border-box; }
  :global(.hl-fill) .w.active { background: color-mix(in srgb, var(--accent) 24%, transparent); box-shadow: 0 0 0 0.1em color-mix(in srgb, var(--accent) 24%, transparent); border-radius: 0.28em; }
  :global(.hl-fill) .w.active .t { color: var(--accent); }
  :global(.hl-underline) .w.active .t { text-decoration: underline; text-decoration-color: var(--accent); text-decoration-thickness: 3px; text-underline-offset: 0.3em; color: var(--accent); filter: drop-shadow(0 0 0.16em color-mix(in srgb, var(--accent) 60%, transparent)); }

  .m { display: block; font-family: var(--ui); font-size: 12.5px; line-height: 1.35; color: var(--ink-dim); text-align: center; max-width: 9em; direction: ltr; user-select: text; white-space: normal; margin: -4px auto 0; }
  .m em { display: block; font-style: normal; opacity: 0.75; font-size: 11.5px; }

  /* tajweed rule colours (tuned to stay legible on every theme) */
  .t :global([class^='tj-']) { color: inherit; }
  .t :global(.tj-ham_wasl), .t :global(.tj-slnt), .t :global(.tj-laam_shamsiyah) { color: var(--ink-faint); }
  .t :global(.tj-madda_normal) { color: #e0803a; }
  .t :global(.tj-madda_permissible) { color: #e0a23a; }
  .t :global(.tj-madda_necessary), .t :global(.tj-madda_obligatory) { color: #d6453d; }
  .t :global(.tj-qalaqah) { color: #3d9ad6; }
  .t :global(.tj-ikhfa_shafawi), .t :global(.tj-ikhfa) { color: #c75a9a; }
  .t :global(.tj-iqlab) { color: #3dba9a; }
  .t :global(.tj-idgham_shafawi), .t :global(.tj-idgham_ghunnah), .t :global(.tj-idgham_wo_ghunnah), .t :global(.tj-idgham_mutajanisayn), .t :global(.tj-idgham_mutaqaribayn) { color: #7cba3d; }
  .t :global(.tj-ghunnah) { color: #4aa86a; }
</style>
