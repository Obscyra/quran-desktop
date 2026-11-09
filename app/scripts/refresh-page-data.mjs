// Refresh bundled Madani word/page data and the navigation map from Quran.com.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../static/data/verses/', import.meta.url);
const V4 = 'https://api.quran.com/api/v4';
const ranges = [];
const starts = [];
const versePages = [];

async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(40000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function stripTags(html) {
  return html.replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim();
}

for (let chapter = 1; chapter <= 114; chapter++) {
  const verses = [];
  for (let page = 1; ; page++) {
    const fields = 'text_uthmani,text_uthmani_tajweed,code_v2,v2_page';
    const data = await get(`${V4}/verses/by_chapter/${chapter}?words=true&per_page=50&page=${page}&word_fields=${fields}&translations=20`);
    verses.push(...data.verses);
    if (!data.pagination.next_page) break;
  }

  const pages = [];
  const out = verses.map((verse) => {
    const end = verse.words.find((word) => word.char_type_name === 'end');
    const words = verse.words.filter((word) => word.char_type_name === 'word');
    for (const word of words) pages.push(word.page_number);
    return {
      n: verse.verse_number,
      juz: verse.juz_number,
      translation: verse.translations?.[0] ? stripTags(verse.translations[0].text) : undefined,
      endGlyph: end?.code_v2 ?? '',
      endPage: end?.v2_page ?? 0,
      words: words.map((word) => ({
        pos: word.position,
        text: word.text_uthmani,
        glyph: word.code_v2 ?? '',
        gp: word.v2_page ?? word.page_number,
        taj: word.text_uthmani_tajweed ?? word.text_uthmani,
        aud: word.audio_url ?? '',
        translation: word.translation?.text ?? '',
        transliteration: word.transliteration?.text ?? '',
        page: word.page_number,
        line: word.line_number
      }))
    };
  });

  const firstPage = out[0]?.words[0]?.page;
  if (!firstPage || !pages.length) throw new Error(`Missing page mapping for chapter ${chapter}`);
  starts.push(firstPage);
  ranges.push([Math.min(...pages), Math.max(...pages)]);
  versePages.push(out.map((verse) => verse.words[0]?.page ?? 0));
  await writeFile(new URL(`${chapter}.json`, root), JSON.stringify(out));
  console.log(`Refreshed ${chapter}/114`);
}

await mkdir(new URL('../src/lib/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../src/lib/page-map.json', import.meta.url),
  JSON.stringify({ chapterRanges: ranges, chapterStarts: starts, versePages })
);
