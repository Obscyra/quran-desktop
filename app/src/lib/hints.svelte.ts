import { settings } from './settings.svelte';
import { ui, type SettingsArea } from './ui.svelte';

/**
 * Feature hints: when someone keeps doing something a setting would take care of (summoning the hover player, scrolling back to the
 * recited verse, zooming a page), a small card offers that setting right there. Everything is counted on this device only.
 */
export interface Hint {
  id: string;
  /** the behaviour that earns the hint, and how many times of it */
  event: 'barPeek' | 'backArrow' | 'zoom';
  need: number;
  title: string;
  body: string;
  /** the switch shown in the card, worded as in Settings */
  label: string;
  area: SettingsArea;
  /** false once the reader has already chosen: the hint is not needed */
  eligible: () => boolean;
  on: () => boolean;
  set: (v: boolean) => void;
}

export const HINTS: Hint[] = [
  {
    id: 'player-bar',
    event: 'barPeek',
    need: 5,
    title: 'Keep the player in view?',
    body: 'The player slides up when you move to the bottom edge. Switch this off and it stays where you can see it.',
    label: 'Show the player only on hover',
    area: 'audio',
    eligible: () => settings.isDefault(['playerHover']),
    on: () => settings.playerHover,
    set: (v) => (settings.playerHover = v)
  },
  {
    id: 'lock-verse',
    event: 'backArrow',
    need: 2,
    title: 'Stay with the recitation?',
    body: 'Lock on the playing verse brings the page back to the verse being recited whenever you let go of the scroll.',
    label: 'Lock on the playing verse',
    area: 'reading',
    eligible: () => settings.isDefault(['lockPlaying']),
    on: () => settings.lockPlaying,
    set: (v) => (settings.lockPlaying = v)
  },
  {
    id: 'page-fill',
    event: 'zoom',
    need: 4,
    title: 'Want the page wider?',
    body: 'Fill lets the page take the full width of the window, instead of fitting the whole page in view.',
    label: 'Fill the width of the window',
    area: 'pages',
    eligible: () => settings.isDefault(['pageFit']),
    on: () => settings.pageFit === 'fill',
    set: (v) => {
      settings.pageFit = v ? 'fill' : 'fit';
      settings.pageZoom = 1;
    }
  }
];

interface Saved {
  counts: Record<string, number>;
  /** per hint: how often it was shown, and whether it must never come back */
  seen: Record<string, { shown: number; never: boolean }>;
  last: number;
}

const KEY = 'quran.hints';
const DAY = 20 * 3600 * 1000;

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s?.counts && s.seen) return s;
  } catch {
    /* none yet */
  }
  return { counts: {}, seen: {}, last: 0 };
}

class Hints {
  private data = load();
  /** the hint on screen */
  current = $state<Hint | null>(null);
  /** the reader used the switch in the card */
  changed = $state(false);
  private session = false;
  private timer = 0;

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage full or blocked */
    }
  }

  /** count one thing the reader did; a hint comes up once it has happened often enough */
  note(event: Hint['event']) {
    const d = this.data;
    d.counts[event] = (d.counts[event] ?? 0) + 1;
    this.save();
    const hint = HINTS.find((h) => h.event === event && this.earned(h));
    if (!hint) return;
    this.later(hint, 1400, 40);
  }

  /** a moment after the action, and only if the moment is right; if something else is on screen, look again in a few seconds */
  private later(hint: Hint, ms: number, tries: number) {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      if (this.due(hint)) this.show(hint);
      else if (tries > 0 && !this.current) this.later(hint, 4000, tries - 1);
    }, ms);
  }

  /** this hint has earned its turn (whatever is on screen right now aside) */
  private earned(h: Hint) {
    const d = this.data;
    const seen = d.seen[h.id];
    if (!settings.tips || this.session || seen?.never || (seen?.shown ?? 0) >= 2) return false;
    if ((d.counts[h.event] ?? 0) < h.need) return false;
    if (Date.now() - d.last < DAY) return false;
    return h.eligible();
  }

  /** and the moment is right: nothing else is asking for attention */
  private clear() {
    return !(this.current || ui.welcome || ui.settingsOpen || ui.notice || ui.focus);
  }

  private due(h: Hint) {
    return this.earned(h) && this.clear();
  }

  private show(h: Hint) {
    const d = this.data;
    const seen = (d.seen[h.id] ??= { shown: 0, never: false });
    seen.shown++;
    d.counts[h.event] = 0; // after "Not now" it takes as many more times to come back
    d.last = Date.now();
    this.save();
    this.session = true;
    this.changed = false;
    this.current = h;
  }

  /** the switch in the card: the setting changes at once */
  toggle() {
    const h = this.current;
    if (!h) return;
    h.set(!h.on());
    this.changed = true;
    this.data.seen[h.id] = { shown: this.data.seen[h.id]?.shown ?? 1, never: true };
    this.save();
  }

  /** "Not now" or closing: it may return later (at most twice in all) */
  close() {
    this.current = null;
  }

  /** "Don't show again" */
  never() {
    const h = this.current;
    if (h) {
      this.data.seen[h.id] = { shown: this.data.seen[h.id]?.shown ?? 1, never: true };
      this.save();
    }
    this.current = null;
  }

  /** the "Show tips" switch: off closes any card; on again lets every hint come back */
  enable(on: boolean) {
    settings.tips = on;
    if (!on) {
      clearTimeout(this.timer);
      this.current = null;
      return;
    }
    this.data = { counts: {}, seen: {}, last: 0 };
    this.session = false;
    this.save();
  }

  /** open the same setting in Settings */
  openSettings() {
    const h = this.current;
    if (!h) return;
    this.current = null;
    ui.openSettings(h.area);
  }
}

export const hints = new Hints();
