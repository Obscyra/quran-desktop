export interface Chapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  verses_count: number;
  revelation_place: string;
  bismillah_pre: boolean;
  translated_name: { name: string };
}

export interface Reciter {
  id: number;
  name: string;
  style: string | null;
  /** quran.com's id for the person (one qari can have several recitations) */
  rid?: number;
  /** portrait path on quran.com's image host */
  photo?: string | null;
  /** no word-level timings: the word highlight is estimated within each verse */
  approx?: boolean;
  /** quranicaudio.com folder: a whole-surah recording with no verse or word timings (listen only) */
  plain?: string;
}

export interface Word {
  pos: number;
  text: string;
  translation: string;
  transliteration: string;
  /** Madani mushaf page and line this word sits on */
  page: number;
  line: number;
  /** quran.com page-font glyph for this word, and the page whose font holds it */
  glyph: string;
  gp: number;
  /** Uthmani text with tajweed rules marked up, e.g. `<rule class=ghunnah>`…`</rule>` */
  taj: string;
  /** word audio file, relative to audio.qurancdn.com */
  aud: string;
  /** IndoPak spelling and its position in the 15-line Pakistani print (fetched on demand) */
  indo?: { text: string; page: number; line: number };
}

export interface Verse {
  n: number;
  words: Word[];
  translation?: string;
  juz: number;
  /** glyph (and its page font) of the printed verse-end ornament */
  endGlyph: string;
  endPage: number;
}

export interface TranslationInfo {
  id: number;
  name: string;
  author: string;
  language: string;
}

/** One word's span inside the chapter audio file, in milliseconds. */
export interface WordTiming {
  verse: number;
  pos: number;
  start: number;
  end: number;
}

export interface ChapterAudio {
  url: string;
  timings: WordTiming[];
  /** verse boundaries, for recordings that have no word-level timings */
  spans?: { verse: number; start: number; end: number }[];
  /** the word timings were estimated from verse boundaries */
  approx?: boolean;
  /** a whole-surah file with no timings at all: no highlight, no verse stepping */
  plain?: boolean;
}
