import * as offline from './offline';
import { RECITERS, REMOVED_RECITERS } from './reciters';
import { QURANICAUDIO } from './reciters-qa';
import { portraitOf } from './reciters-photos';
import type { Chapter, ChapterAudio, Reciter, TranslationInfo, Verse, WordTiming } from './types';

const V4 = 'https://api.quran.com/api/v4';
const QDC = 'https://api.quran.com/api/qdc';

async function getJson<T>(url: string, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      // a stalled connection must end in an error, not hang for ever
      const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (res.ok) return (await res.json()) as T;
      last = new Error(`${res.status} ${url}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  throw last;
}

/**
 * The Arabic text of the whole Quran ships with the app (see scripts/bundle-data.mjs), so reading never waits for the
 * network. Only what cannot be bundled is fetched: other translations, and audio.
 */
async function bundled<T>(path: string): Promise<T | undefined> {
  try {
    const res = await fetch(`/data/${path}`);
    if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) return (await res.json()) as T;
  } catch {
    /* not in this build: use the network */
  }
}

/** The translation that comes with the text (Saheeh International). */
export const BUNDLED_TRANSLATION = 20;
const partial = new WeakSet<object>();
/** true for text shown without its chosen translation because that translation could not be fetched (offline) */
export const isPartial = (v: object) => partial.has(v);

export async function fetchChapters(): Promise<Chapter[]> {
  const local = await bundled<Chapter[]>('chapters.json');
  if (local?.length === 114) return local;
  const d = await getJson<{ chapters: Chapter[] }>(`${V4}/chapters?language=en`);
  return d.chapters;
}

/** recitations from quranicaudio.com keep their ids above this, so they never meet quran.com's */
export const QA_BASE = 10000;
const plainPaths = new Map<number, string>();
// quranicaudio.com's own list cannot be read from a browser (no CORS), so a copy ships with the app (scripts/update-reciters.mjs)
const QA_RECITERS: Reciter[] = QURANICAUDIO.map(([id, name, folder]) => ({ id: QA_BASE + id, name, style: 'Murattal', plain: folder, photo: portraitOf({ name }) }));
for (const r of QA_RECITERS) plainPaths.set(r.id, r.plain!);

/**
 * quran.com's own list (with portraits), plus any recitation its API offers that the list lacks, plus the whole-surah
 * recordings of quranicaudio.com (listen only: they come without verse or word timings).
 */
export async function fetchReciters(): Promise<Reciter[]> {
  const out = [...RECITERS];
  try {
    const d = await getJson<{ reciters: Record<string, unknown>[] }>(`${V4}/resources/chapter_reciters`, 1);
    const known = new Set(out.map((r) => r.id));
    for (const r of d.reciters ?? []) {
      const id = Number(r.id);
      const name = String(r.name ?? r.reciter_name ?? '');
      const style = typeof r.style === 'string' ? r.style : ((r.style as { name?: string } | null)?.name ?? null);
      if (id && name && !known.has(id) && id !== 97 && !(id in REMOVED_RECITERS)) out.push({ id, name, style });
    }
  } catch {
    /* the bundled list is complete enough on its own */
  }
  out.push(...QA_RECITERS);
  for (const r of out) if (r.plain) plainPaths.set(r.id, r.plain);
  return out;
}

const stripTags = (html: string) => html.replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim();

export async function fetchTranslations(): Promise<TranslationInfo[]> {
  const d = await getJson<{
    translations: { id: number; name: string; author_name: string; language_name: string }[];
  }>(`${V4}/resources/translations`);
  return d.translations.map((t) => ({
    id: t.id,
    name: t.name,
    author: t.author_name,
    language: t.language_name.charAt(0).toUpperCase() + t.language_name.slice(1)
  }));
}

interface ApiWord {
  position: number;
  char_type_name: string;
  text_uthmani: string;
  text_indopak?: string;
  text_uthmani_tajweed?: string;
  code_v2?: string;
  v2_page?: number;
  audio_url?: string | null;
  page_number: number;
  line_number: number;
  translation?: { text: string };
  transliteration?: { text: string };
}
interface ApiVerse {
  verse_number: number;
  juz_number: number;
  translations?: { text: string }[];
  words: ApiWord[];
}
interface Paged {
  verses: ApiVerse[];
  pagination: { next_page: number | null };
}

async function allVerses(chapter: number, query: string): Promise<ApiVerse[]> {
  const out: ApiVerse[] = [];
  for (let page = 1; ; page++) {
    const d = await getJson<Paged>(`${V4}/verses/by_chapter/${chapter}?words=true&per_page=50&page=${page}&${query}`);
    out.push(...d.verses);
    if (!d.pagination.next_page) break;
  }
  return out;
}

/**
 * The verse translations of a surah to put under the bundled Arabic, and, when the language is not English, the word
 * meanings in that language (the bundled ones are English).
 */
async function extrasOf(chapter: number, translation: number, lang: string) {
  const tr = new Map<number, string>();
  const words = new Map<string, string>();
  const body = lang === 'en' ? 'words=false' : `words=true&language=${lang}`;
  const want = translation ? `&translations=${translation}` : '';
  for (let page = 1; ; page++) {
    const d = await getJson<Paged>(`${V4}/verses/by_chapter/${chapter}?${body}&per_page=50&page=${page}${want}`);
    for (const v of d.verses) {
      if (v.translations?.[0]) tr.set(v.verse_number, stripTags(v.translations[0].text));
      for (const w of v.words ?? []) if (w.char_type_name === 'word' && w.translation?.text) words.set(`${v.verse_number}-${w.position}`, w.translation.text);
    }
    if (!d.pagination.next_page) break;
  }
  return { tr, words };
}

/** `lang` is the word-meaning language (see languages.ts); the bundled text is English. */
export async function fetchVerses(chapter: number, translation: number, lang = 'en'): Promise<Verse[]> {
  // text the provider has corrected since the installer was built (see datasync.svelte.ts) wins over the bundled copy
  const local = (await offline.getFresh(chapter).catch(() => undefined)) ?? (await bundled<Verse[]>(`verses/${chapter}.json`));
  if (local) {
    const own = !translation || translation === BUNDLED_TRANSLATION;
    if (own && lang === 'en') return translation ? local : local.map((v) => ({ ...v, translation: undefined }));
    try {
      const x = await extrasOf(chapter, own ? 0 : translation, lang);
      return local.map((v) => ({
        ...v,
        translation: own ? (translation ? v.translation : undefined) : x.tr.get(v.n),
        words: lang === 'en' ? v.words : v.words.map((w) => ({ ...w, translation: x.words.get(`${v.n}-${w.pos}`) ?? w.translation }))
      }));
    } catch {
      // offline and this translation was never downloaded: the Arabic is still all there
      const bare = local.map((v) => ({ ...v, translation: own && translation ? v.translation : undefined }));
      partial.add(bare);
      return bare;
    }
  }
  return fetchVersesOnline(chapter, translation, lang);
}

/** The same text straight from the API (what scripts/bundle-data.mjs saves). */
export async function fetchVersesOnline(chapter: number, translation: number, lang = 'en'): Promise<Verse[]> {
  const tr = translation ? `&translations=${translation}` : '';
  const wl = lang === 'en' ? '' : `&language=${lang}`;
  const fields = 'text_uthmani,text_uthmani_tajweed,code_v2,v2_page';
  const verses = await allVerses(chapter, `word_fields=${fields}${tr}${wl}`);
  return verses.map((v) => {
    const end = v.words.find((w) => w.char_type_name === 'end');
    return {
      n: v.verse_number,
      juz: v.juz_number,
      translation: v.translations?.[0] ? stripTags(v.translations[0].text) : undefined,
      endGlyph: end?.code_v2 ?? '',
      endPage: end?.v2_page ?? 0,
      words: v.words
        .filter((w) => w.char_type_name === 'word')
        .map((w) => ({
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
}

/** IndoPak spelling and page/line of every word (the 15-line Pakistani print), keyed "verse-pos". */
/** The bundled copy of a surah's IndoPak spelling, for comparing with the provider's. */
export const bundledIndo = (chapter: number) => bundled<Record<string, { text: string; page: number; line: number }>>(`indo/${chapter}.json`);
/** The bundled copy of a surah's text. */
export const bundledVerses = (chapter: number) => bundled<Verse[]>(`verses/${chapter}.json`);

export async function fetchIndo(chapter: number): Promise<Record<string, { text: string; page: number; line: number }>> {
  const local = await bundled<Record<string, { text: string; page: number; line: number }>>(`indo/${chapter}.json`);
  if (local) return local;
  return fetchIndoOnline(chapter);
}

export async function fetchIndoOnline(chapter: number): Promise<Record<string, { text: string; page: number; line: number }>> {
  const verses = await allVerses(chapter, 'word_fields=text_indopak&mushaf=3');
  const out: Record<string, { text: string; page: number; line: number }> = {};
  for (const v of verses)
    for (const w of v.words)
      if (w.char_type_name === 'word')
        out[`${v.verse_number}-${w.position}`] = { text: w.text_indopak ?? w.text_uthmani, page: w.page_number, line: w.line_number };
  return out;
}

export async function fetchChapterAudio(reciter: number, chapter: number): Promise<ChapterAudio> {
  const folder = plainPaths.get(reciter);
  if (folder) return { url: `https://download.quranicaudio.com/quran/${folder}${String(chapter).padStart(3, '0')}.mp3`, timings: [], plain: true };
  const d = await getJson<{
    audio_file: {
      audio_url: string;
      timestamps?: { verse_key: string; timestamp_from: number; timestamp_to: number; segments: [number, number, number][] }[];
    };
  }>(`${V4}/chapter_recitations/${reciter}/${chapter}?segments=true`);
  const timings: WordTiming[] = [];
  const spans: { verse: number; start: number; end: number }[] = [];
  for (const t of d.audio_file.timestamps ?? []) {
    const verse = Number(t.verse_key.split(':')[1]);
    spans.push({ verse, start: t.timestamp_from, end: t.timestamp_to });
    for (const [pos, start, end] of t.segments) timings.push({ verse, pos, start, end });
  }
  timings.sort((a, b) => a.start - b.start);
  return { url: d.audio_file.audio_url, timings, spans };
}
