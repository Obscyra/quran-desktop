// Downloads everything the app needs to read the whole Quran with no connection, into static/ so it ships in the installer:
//   static/data/chapters.json         the surah list
//   static/data/verses/<n>.json       every verse of surah n: words, glyphs, tajweed, default translation (same shape as api.fetchVerses)
//   static/data/indo/<n>.json         IndoPak spelling and page/line of every word (same shape as api.fetchIndo)
//   static/fonts/qcf/p<n>.woff2       the 604 Mushaf page fonts
//   static/data/manifest.json         when it was built and the size of every font, so the app can tell which ones the provider has changed since
// Run it again to refresh. It skips files that already exist (use --force to redo them).
// Audio is not bundled (many gigabytes); it is downloaded per reciter from the Audio manager.
// Keep the mapping below in step with src/lib/api.ts.
import { mkdir, writeFile, access, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'static');
const V4 = 'https://api.quran.com/api/v4';
const FONTS = 'https://verses.quran.foundation/fonts/quran/hafs/v2/woff2';
const DEFAULT_TRANSLATION = 20; // Saheeh International, the app's default
const force = process.argv.includes('--force');

const exists = (p) => access(p).then(() => true, () => false);
async function get(url, bin = false) {
  let last;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(40000) });
      if (r.ok) return bin ? Buffer.from(await r.arrayBuffer()) : await r.json();
      last = new Error(`${r.status} ${url}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  throw last;
}
async function save(rel, data) {
  const p = join(root, rel);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, data);
}
async function pool(items, n, fn) {
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
      if (++done % 25 === 0 || done === items.length) process.stdout.write(`  ${done}/${items.length}\n`);
    }
  }));
}

const stripTags = (html) => html.replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim();
async function allVerses(ch, query) {
  const out = [];
  for (let page = 1; ; page++) {
    const d = await get(`${V4}/verses/by_chapter/${ch}?words=true&per_page=50&page=${page}&${query}`);
    out.push(...d.verses);
    if (!d.pagination.next_page) break;
  }
  return out;
}

console.log('chapters');
const chapters = (await get(`${V4}/chapters?language=en`)).chapters;
if (chapters.length !== 114) throw new Error('expected 114 surahs');
await save('data/chapters.json', JSON.stringify(chapters));

const nums = Array.from({ length: 114 }, (_, i) => i + 1);

console.log('verses');
await pool(nums, 5, async (ch) => {
  if (!force && (await exists(join(root, `data/verses/${ch}.json`)))) return;
  const verses = await allVerses(ch, `word_fields=text_uthmani,text_uthmani_tajweed,code_v2,v2_page&translations=${DEFAULT_TRANSLATION}`);
  const out = verses.map((v) => {
    const end = v.words.find((w) => w.char_type_name === 'end');
    return {
      n: v.verse_number,
      juz: v.juz_number,
      translation: v.translations?.[0] ? stripTags(v.translations[0].text) : undefined,
      endGlyph: end?.code_v2 ?? '',
      endPage: end?.v2_page ?? 0,
      words: v.words.filter((w) => w.char_type_name === 'word').map((w) => ({
        pos: w.position,
        text: w.text_uthmani,
        glyph: w.code_v2 ?? '',
        gp: w.v2_page ?? w.page_number,
        taj: w.text_uthmani_tajweed ?? w.text_uthmani,
        aud: w.audio_url ?? '',
        translation: w.translation?.text ?? '',
        transliteration: w.transliteration?.text ?? '',
        page: w.page_number,
        line: w.line_number
      }))
    };
  });
  await save(`data/verses/${ch}.json`, JSON.stringify(out));
});

console.log('indopak');
await pool(nums, 5, async (ch) => {
  if (!force && (await exists(join(root, `data/indo/${ch}.json`)))) return;
  const verses = await allVerses(ch, 'word_fields=text_indopak&mushaf=3');
  const out = {};
  for (const v of verses)
    for (const w of v.words)
      if (w.char_type_name === 'word') out[`${v.verse_number}-${w.position}`] = { text: w.text_indopak ?? w.text_uthmani, page: w.page_number, line: w.line_number };
  await save(`data/indo/${ch}.json`, JSON.stringify(out));
});

console.log('page fonts');
await pool(Array.from({ length: 604 }, (_, i) => i + 1), 8, async (p) => {
  if (!force && (await exists(join(root, `fonts/qcf/p${p}.woff2`)))) return;
  await save(`fonts/qcf/p${p}.woff2`, await get(`${FONTS}/p${p}.woff2`, true));
});
const fonts = {};
for (let p = 1; p <= 604; p++) fonts[p] = (await stat(join(root, `fonts/qcf/p${p}.woff2`))).size;
await save('data/manifest.json', JSON.stringify({ built: new Date().toISOString(), fonts }));
console.log('done');
