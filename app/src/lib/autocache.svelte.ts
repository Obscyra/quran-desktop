/**
 * Surahs you listen to regularly are kept offline without being asked, and let go again after a month
 * without listening. Recitations you downloaded yourself are never touched: only the ones saved here.
 */
const DAY = 86_400_000;
/** how long an automatically saved recitation may go unheard */
export const KEEP_DAYS = 30;
/** listening on this many different days within the last KEEP_DAYS counts as regular */
const REGULAR_DAYS = 3;

const LISTENS = 'quran.listens';
const AUTO = 'quran.autocached';

const read = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T;
  } catch {
    return fallback;
  }
};
const dayStart = (t: number) => Math.floor(t / DAY) * DAY;

class AutoCache {
  /** "reciter:surah" to the days (as timestamps) it was listened to */
  private listens: Record<string, number[]> = read(LISTENS, {});
  /** "reciter:surah" saved automatically, with when */
  auto = $state<Record<string, number>>(read(AUTO, {}));

  private save() {
    try {
      localStorage.setItem(LISTENS, JSON.stringify(this.listens));
      localStorage.setItem(AUTO, JSON.stringify(this.auto));
    } catch {
      /* storage full or blocked: this only costs the memory of what was listened to */
    }
  }

  /** Note a listen today. Returns true once the surah has become a regular one. */
  heard(key: string, now = Date.now()): boolean {
    const day = dayStart(now);
    const days = (this.listens[key] ?? []).filter((d) => now - d < 2 * KEEP_DAYS * DAY);
    if (!days.includes(day)) days.push(day);
    this.listens[key] = days;
    this.save();
    return days.filter((d) => now - d < KEEP_DAYS * DAY).length >= REGULAR_DAYS;
  }

  isAuto = (key: string) => key in this.auto;
  mark(key: string, now = Date.now()) {
    this.auto[key] = now;
    this.save();
  }
  /** Downloaded or deleted by hand: no longer ours to manage. */
  release(key: string) {
    if (!(key in this.auto)) return;
    delete this.auto[key];
    this.save();
  }
  /** Forget saved surahs that are no longer on the device. */
  prune(present: Set<string>) {
    let changed = false;
    for (const k of Object.keys(this.auto)) if (!present.has(k)) (delete this.auto[k], (changed = true));
    if (changed) this.save();
  }

  private lastHeard(key: string) {
    return Math.max(this.auto[key] ?? 0, ...(this.listens[key] ?? [0]));
  }
  /** Whole days an automatically saved recitation has left before it is dropped. */
  daysLeft(key: string, now = Date.now()) {
    return Math.max(0, Math.ceil(KEEP_DAYS - (now - this.lastHeard(key)) / DAY));
  }
  /** Automatically saved recitations that have gone unheard for too long. */
  expired(now = Date.now()): string[] {
    return Object.keys(this.auto).filter((k) => now - this.lastHeard(k) > KEEP_DAYS * DAY);
  }
}

export const autocache = new AutoCache();
