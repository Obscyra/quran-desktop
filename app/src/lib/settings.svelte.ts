export type Mode = 'verse' | 'reading';
export type ReadingStyle = 'arabic' | 'translation';
export type PageFlow = 'page' | 'scroll';
export type PageType = 'madani' | 'indopak';
export type PageLook = 'paper' | 'frame' | 'plain';
export type Script = 'mushaf' | 'tajweed' | 'uthmani' | 'indopak' | 'naskh' | 'amiri' | 'scheherazade';
export type Highlight = 'sweep' | 'fill' | 'underline';
export type WordMeaning = 'off' | 'hover' | 'below';
export type ListenBar = 'demand' | 'always';

export const SCRIPTS: { id: Script; name: string; hint: string; family: string }[] = [
  { id: 'mushaf', name: 'Madani Mushaf', hint: 'The printed Mushaf, glyph for glyph. The most exact.', family: '' },
  { id: 'tajweed', name: 'Tajweed', hint: 'Uthmani text coloured by tajweed rules.', family: "'KFGQPC Uthmanic Hafs'" },
  { id: 'uthmani', name: 'Uthmani', hint: 'King Fahd Complex Uthmani text.', family: "'KFGQPC Uthmanic Hafs'" },
  { id: 'indopak', name: 'IndoPak', hint: 'Nastaleeq style used across South Asia.', family: "'IndoPak Nastaleeq'" },
  { id: 'naskh', name: 'Naskh', hint: 'Clear modern Naskh, easy on small text.', family: "'Noto Naskh Arabic'" },
  { id: 'amiri', name: 'Amiri Quran', hint: 'Classical calligraphic style.', family: "'Amiri Quran'" },
  { id: 'scheherazade', name: 'Scheherazade', hint: 'Open, generous spacing.', family: "'Scheherazade New'" }
];

const defaults = {
  theme: 'night',
  mode: 'verse' as Mode,
  readingStyle: 'arabic' as ReadingStyle,
  flow: 'page' as PageFlow,
  spread: false,
  pageType: 'madani' as PageType,
  pageLook: 'paper' as PageLook,
  showPageInfo: true,
  highlightBookmarks: true,
  script: 'mushaf' as Script,
  listenBar: 'demand' as ListenBar,
  /** the player bar floats over the page and only shows while the mouse is at the bottom edge */
  playerHover: false,
  wordAudio: true,
  sidebar: true,
  volume: 1,
  size: 56,
  spacing: 1.9,
  highlight: 'sweep' as Highlight,
  translation: 20,
  translationSize: 20,
  wordMeaning: 'hover' as WordMeaning,
  transliteration: false,
  arabicNames: false,
  speed: 1,
  autoAdvance: true,
  repeatSurah: false,
  autoScroll: true,
  lockPlaying: false,
  keepAwake: true,
  /** keep surahs you listen to regularly offline, and drop them again after a month without listening */
  autoCache: true,
  autoHideChrome: true,
  checkUpdates: true,
  /** closing the window keeps the app in the system tray, so reminders still arrive */
  background: true,
  /** scale of the whole interface (1 = normal) */
  uiScale: 1,
  remindersOn: false,
  /** "HH:MM" times, comma separated */
  remindTimes: '08:00,20:00',
  remindMessage: 'Take a few minutes with the Quran.',
  dailyVerse: true,
  dailyVerseTime: '09:00',
  /** also use the system notification centre when the window is not in front */
  systemNotify: true
};
export type SettingsShape = typeof defaults;

const KEY = 'quran.settings.v2';

class Settings {
  theme = $state(defaults.theme);
  mode = $state(defaults.mode);
  readingStyle = $state(defaults.readingStyle);
  flow = $state(defaults.flow);
  spread = $state(defaults.spread);
  pageType = $state(defaults.pageType);
  pageLook = $state(defaults.pageLook);
  showPageInfo = $state(defaults.showPageInfo);
  highlightBookmarks = $state(defaults.highlightBookmarks);
  script = $state(defaults.script);
  listenBar = $state(defaults.listenBar);
  playerHover = $state(defaults.playerHover);
  wordAudio = $state(defaults.wordAudio);
  sidebar = $state(defaults.sidebar);
  volume = $state(defaults.volume);
  size = $state(defaults.size);
  spacing = $state(defaults.spacing);
  highlight = $state(defaults.highlight);
  translation = $state(defaults.translation);
  translationSize = $state(defaults.translationSize);
  wordMeaning = $state(defaults.wordMeaning);
  transliteration = $state(defaults.transliteration);
  arabicNames = $state(defaults.arabicNames);
  speed = $state(defaults.speed);
  autoAdvance = $state(defaults.autoAdvance);
  repeatSurah = $state(defaults.repeatSurah);
  autoScroll = $state(defaults.autoScroll);
  lockPlaying = $state(defaults.lockPlaying);
  keepAwake = $state(defaults.keepAwake);
  autoCache = $state(defaults.autoCache);
  autoHideChrome = $state(defaults.autoHideChrome);
  checkUpdates = $state(defaults.checkUpdates);
  background = $state(defaults.background);
  uiScale = $state(defaults.uiScale);
  remindersOn = $state(defaults.remindersOn);
  remindTimes = $state(defaults.remindTimes);
  remindMessage = $state(defaults.remindMessage);
  dailyVerse = $state(defaults.dailyVerse);
  dailyVerseTime = $state(defaults.dailyVerseTime);
  systemNotify = $state(defaults.systemNotify);

  /** no saved settings yet: the app has never been opened on this computer (the welcome setup is for them) */
  readonly firstRun: boolean = (() => {
    try {
      return localStorage.getItem(KEY) === null && localStorage.getItem('quran.welcomed') === null;
    } catch {
      return false;
    }
  })();

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      for (const k of Object.keys(defaults) as (keyof SettingsShape)[]) {
        if (k in saved && typeof saved[k] === typeof defaults[k]) (this as Record<string, unknown>)[k] = saved[k];
      }
      // earlier betas shipped smaller defaults; anyone who never changed them gets the larger ones
      if (saved.size === 40) this.size = defaults.size;
      if (saved.translationSize === 18) this.translationSize = defaults.translationSize;
    } catch {
      /* first run or corrupt value: keep defaults */
    }
  }

  get fontFamily() {
    return SCRIPTS.find((f) => f.id === this.script)?.family || "'KFGQPC Uthmanic Hafs'";
  }
  /** which printed layout supplies the page and line of every word */
  get layout(): PageType {
    return this.script === 'mushaf' ? 'madani' : this.pageType;
  }
  get needsIndo() {
    return this.script === 'indopak' || this.pageType === 'indopak';
  }

  snapshot(): SettingsShape {
    const out = {} as Record<string, unknown>;
    for (const k of Object.keys(defaults)) out[k] = (this as unknown as Record<string, unknown>)[k];
    return out as SettingsShape;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.snapshot()));
    } catch {
      /* storage full or blocked */
    }
  }

  reset() {
    Object.assign(this, defaults);
  }
}

export const settings = new Settings();
