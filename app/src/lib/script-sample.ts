import type { Script } from './settings.svelte';

// the first verse of Al-Fatihah, in every script, for the previews
export const SAMPLE = [
  { glyph: 'ﱁ', text: 'بِسۡمِ', taj: 'بِسۡمِ', indo: 'بِسۡمِ' },
  { glyph: 'ﱂ', text: 'ٱللَّهِ', taj: '<span class="tj-ham_wasl">ٱ</span>للَّهِ', indo: 'اللهِ' },
  { glyph: 'ﱃ', text: 'ٱلرَّحۡمَـٰنِ', taj: '<span class="tj-ham_wasl">ٱ</span><span class="tj-laam_shamsiyah">ل</span>رَّحۡمَ<span class="tj-madda_normal">ـٰ</span>نِ', indo: 'الرَّحۡمٰنِ' },
  { glyph: 'ﱄ', text: 'ٱلرَّحِيمِ', taj: '<span class="tj-ham_wasl">ٱ</span><span class="tj-laam_shamsiyah">ل</span>رَّح<span class="tj-madda_permissible">ِي</span>مِ', indo: 'الرَّحِيۡمِ' }
];
export const sample = (id: Script) =>
  id === 'mushaf' ? SAMPLE.map((w) => w.glyph).join(' ') : id === 'tajweed' ? SAMPLE.map((w) => w.taj).join(' ') : id === 'indopak' ? SAMPLE.map((w) => w.indo).join(' ') : SAMPLE.map((w) => w.text).join(' ');
