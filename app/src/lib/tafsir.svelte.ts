import * as offline from './offline';

/** Pin the static dataset version: jsDelivr may cache tagged files for a long time. */
const BASE = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@v1.2.1/tafsir';
const EDITIONS_KEY = 'quran.tafsir.editions.v1';

export interface TafsirEdition {
  author_name: string;
  id: number;
  language_name: string;
  name: string;
  slug: string;
  source: string;
}
export type { TafsirAyah, TafsirData } from './offline';
import type { TafsirAyah, TafsirData } from './offline';

async function json<T>(url: string, signal?: AbortSignal): Promise<T> {
  let error: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return (await response.json()) as T;
    } catch (e) {
      error = e;
      if (signal?.aborted) throw e;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw error;
}

function validEdition(value: unknown): value is TafsirEdition {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<TafsirEdition>;
  return typeof e.slug === 'string' && /^[a-z0-9-]+$/.test(e.slug) && typeof e.name === 'string' && typeof e.language_name === 'string';
}

/**
 * tafsir_api has shipped both `{ ayahs: [...] }` and bare `[...]` surah
 * responses. Accept both wire formats and normalize to the cache format.
 */
function normalizeTafsir(value: unknown): TafsirData | undefined {
  if (!value || typeof value !== 'object') return;
  const rows = Array.isArray(value) ? value : (value as { ayahs?: unknown }).ayahs;
  if (!Array.isArray(rows) || !rows.every((row) => row && typeof row === 'object'
    && Number.isInteger((row as TafsirAyah).ayah) && (row as TafsirAyah).ayah > 0
    && typeof (row as TafsirAyah).text === 'string')) return;
  return { ayahs: rows as TafsirAyah[] };
}

class Tafsirs {
  editions = $state<TafsirEdition[]>([]);
  ready = $state(false);
  error = $state('');
  private loading: Promise<void> | null = null;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(EDITIONS_KEY) ?? '[]');
      if (Array.isArray(saved)) this.editions = saved.filter(validEdition);
    } catch { /* fetch the list when online */ }
  }

  async load(preferredLanguage = 'english') {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const fresh = await json<unknown>(`${BASE}/editions.json`);
        if (!Array.isArray(fresh) || !fresh.every(validEdition)) throw new Error('The tafsir edition list is invalid.');
        this.editions = fresh;
        localStorage.setItem(EDITIONS_KEY, JSON.stringify(fresh));
        this.error = '';
      } catch (e) {
        this.error = this.editions.length ? '' : e instanceof Error ? e.message : 'Could not load tafsir editions.';
      } finally {
        this.ready = true;
        this.loading = null;
      }
    })();
    return this.loading;
  }

  get grouped(): [string, TafsirEdition[]][] {
    const byLanguage = new Map<string, TafsirEdition[]>();
    for (const edition of this.editions) {
      const language = edition.language_name;
      byLanguage.set(language, [...(byLanguage.get(language) ?? []), edition]);
    }
    return [...byLanguage.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  get(slug: string) { return this.editions.find((e) => e.slug === slug); }

  chooseDefault(language: string) {
    // The API's first Bengali entry (Fathul Majid) has substantial holes; its
    // Bengali Mokhtasar edition has much better verse coverage.
    if (language.toLowerCase() === 'bengali') {
      const fullerBengali = this.editions.find((e) => e.slug === 'bengali-mokhtasar');
      if (fullerBengali) return fullerBengali;
    }
    return this.editions.find((e) => e.language_name.toLowerCase() === language.toLowerCase())
      ?? this.editions.find((e) => e.language_name.toLowerCase() === 'english')
      ?? this.editions[0];
  }

  async chapter(slug: string, chapter: number, signal?: AbortSignal): Promise<TafsirData> {
    const edition = this.get(slug);
    if (!edition || !Number.isInteger(chapter) || chapter < 1 || chapter > 114) throw new Error('Choose an available tafsir edition.');
    const cached = await offline.getTafsir(slug, chapter).catch(() => undefined);
    const cachedData = normalizeTafsir(cached);
    if (cachedData) return cachedData;
    const response = await json<unknown>(`${BASE}/${encodeURIComponent(slug)}/${chapter}.json`, signal);
    const data = normalizeTafsir(response);
    if (!data) throw new Error('The tafsir server returned an unsupported or incomplete response.');
    await offline.putTafsir(slug, chapter, data);
    return data;
  }

  async download(slug: string, chapter: number, signal?: AbortSignal) {
    const data = await this.chapter(slug, chapter, signal);
    if (signal?.aborted) throw new DOMException('Download cancelled.', 'AbortError');
    await offline.putTafsir(slug, chapter, data);
    return data;
  }

  async remove(slug: string, chapter: number) { await offline.deleteTafsir(slug, chapter); }
}

export const tafsirs = new Tafsirs();
