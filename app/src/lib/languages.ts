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

/** Region (country) → the language its readers most likely want the translation in. Only languages quran.com has. */
const REGION: Record<string, string> = {
  BD: 'bn', PK: 'ur', ID: 'id', TR: 'tr', MY: 'ms', BN: 'ms', IR: 'fa', AF: 'fa', RU: 'ru', DE: 'de', AT: 'de', FR: 'fr',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', IT: 'it', NL: 'nl', PT: 'pt', BR: 'pt', CN: 'zh', TW: 'zh', JP: 'ja', KR: 'ko',
  VN: 'vi', TH: 'th', BA: 'bs', AL: 'sq', XK: 'sq', UZ: 'uz', KZ: 'kk', TJ: 'tg', AZ: 'az', NP: 'ne', SO: 'so', TZ: 'sw',
  KE: 'sw', RO: 'ro', PL: 'pl', UA: 'uk', SE: 'sv', NO: 'no', FI: 'fi', CZ: 'cs', BG: 'bg', MK: 'mk', RS: 'sr', GE: 'ka',
  PH: 'tl', KH: 'km', MV: 'dv', ET: 'am', IL: 'he', RW: 'rw', UG: 'lg', NG: 'ha', NE: 'ha', ML: 'bm'
};
const NAME_OF: Record<string, string> = Object.fromEntries(Object.entries(ISO).map(([name, code]) => [code, name]));

/**
 * The translation language suggested by the device: a non-English language in the browser/system language list wins
 * ("bn-BD" → Bengali), otherwise the region of any entry ("en-BD" → Bengali). Returns quran.com's lowercase language name,
 * or null when nothing points away from English.
 */
export function suggestedLanguage(
  tags: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language],
  region?: string | null
): string | null {
  const parsed = tags.map((t) => {
    try {
      const l = new Intl.Locale(t);
      return { lang: l.language, region: l.region };
    } catch {
      return { lang: t.split('-')[0].toLowerCase(), region: t.split('-')[1]?.toUpperCase() };
    }
  });
  for (const p of parsed) if (p.lang !== 'en' && NAME_OF[p.lang]) return NAME_OF[p.lang];
  // the country set in the system itself (a Bangladeshi PC with English Windows says "en-US" but its region is BD)
  if (region && REGION[region.toUpperCase()]) return NAME_OF[REGION[region.toUpperCase()]] ?? null;
  for (const p of parsed) if (p.region && REGION[p.region]) return NAME_OF[REGION[p.region]] ?? null;
  return null;
}
