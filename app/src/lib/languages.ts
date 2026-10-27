/**
 * quran.com's word-by-word meanings come in these languages (its /resources/languages list), keyed by the
 * language name its translation list uses. A language it has no word meanings for is answered in English.
 */
const ISO: Record<string, string> = {
  english: 'en', urdu: 'ur', bengali: 'bn', turkish: 'tr', spanish: 'es', french: 'fr', bosnian: 'bs', russian: 'ru',
  malayalam: 'ml', indonesian: 'id', uzbek: 'uz', dutch: 'nl', german: 'de', tajik: 'tg', tamil: 'ta', japanese: 'ja',
  italian: 'it', vietnamese: 'vi', chinese: 'zh', albanian: 'sq', persian: 'fa', bulgarian: 'bg', bambara: 'bm',
  hausa: 'ha', portuguese: 'pt', romanian: 'ro', hindi: 'hi', swahili: 'sw', kazakh: 'kk', thai: 'th', tagalog: 'tl',
  khmer: 'km', assamese: 'as', korean: 'ko', somali: 'so', azeri: 'az', kurdish: 'ku', divehi: 'dv', malay: 'ms',
  dari: 'prs', amazigh: 'zgh', amharic: 'am', chechen: 'ce', czech: 'cs', finnish: 'fi', gujarati: 'gu', hebrew: 'he',
  georgian: 'ka', kannada: 'kn', kashmiri: 'ks', ganda: 'lg', macedonian: 'mk', marathi: 'mr', maranao: 'mrn',
  nepali: 'ne', norwegian: 'no', oromo: 'om', polish: 'pl', pashto: 'ps', kinyarwanda: 'rw', sindhi: 'sd', sami: 'se',
  sinhala: 'si', serbian: 'sr', swedish: 'sv', telugu: 'te', tatar: 'tt', uighur: 'ug', ukrainian: 'uk', yoruba: 'yo'
};

/** The word-meaning language for a translation's language name ("Urdu" → "ur"); 'en' when unknown. */
export function wordLanguage(name: string | undefined): string {
  const n = (name ?? '').toLowerCase();
  return ISO[n] ?? ISO[n.split(/[ ,]/)[0]] ?? 'en';
}
