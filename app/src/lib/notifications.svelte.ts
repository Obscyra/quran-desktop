import { isTauri } from './platform';
import { player } from './player.svelte';
import { settings } from './settings.svelte';
import { ui, type Notice } from './ui.svelte';

const FIRED = 'quran.notify.fired';
const VOTD = 'quran.votd.v1';

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const minutes = (hhmm: string) => {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
};
const plain = (html: string) => html.replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim();

interface Votd {
  day: string;
  chapter: number;
  verse: number;
  arabic: string;
  translation: string;
  /** the translation the text above is in (0: none) */
  tr: number;
}

/**
 * Reminders at the times the reader chose, and quran.com's verse of the day. While the reader is in
 * the app a card appears in the corner; if the window is behind others the system notification
 * centre is used instead (and the card is waiting on return).
 */
class Notifier {
  private timer = 0;

  start() {
    clearInterval(this.timer);
    setTimeout(() => this.tick(), 6000);
    this.timer = window.setInterval(() => this.tick(), 20000);
  }

  private fired(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(FIRED) ?? '{}');
    } catch {
      return {};
    }
  }
  private mark(slot: string, day: string) {
    try {
      localStorage.setItem(FIRED, JSON.stringify({ ...this.fired(), [slot]: day }));
    } catch {
      /* storage blocked; the worst case is a repeat */
    }
  }

  get times(): string[] {
    return settings.remindTimes.split(',').map((t) => t.trim()).filter((t) => minutes(t) >= 0);
  }

  private async tick() {
    const now = new Date();
    const day = dayKey(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const done = this.fired();

    if (settings.remindersOn) {
      for (const t of this.times) {
        const late = nowMin - minutes(t);
        // on time, or up to ten minutes late (the computer was asleep); never twice in a day
        if (late >= 0 && late <= 10 && done[`r${t}`] !== day) {
          this.mark(`r${t}`, day);
          // a reminder to open the app is pointless while the app is open and in front
          if (this.inFront()) return;
          await this.deliver({ kind: 'reminder', title: 'Quran reminder', body: settings.remindMessage || 'Time to read.' });
          return;
        }
      }
    }
    // the verse of the day appears once a day, from its time onwards, as soon as the app is open
    if (settings.dailyVerse && nowMin >= minutes(settings.dailyVerseTime) && done.votd !== day) {
      this.mark('votd', day);
      await this.showVerseOfTheDay();
    }
  }

  private inFront() {
    return document.hasFocus() && !document.hidden;
  }

  private async fetchJson(url: string) {
    let last: unknown;
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(url);
        if (res.ok) return await res.json();
        last = new Error(String(res.status));
      } catch (e) {
        last = e;
      }
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
    throw last;
  }

  /**
   * quran.com's verse for today: one verse per day, kept so the same one shows all day, and always
   * in the translation the reader has chosen now (0 means none: the Arabic alone).
   */
  async verseOfTheDay(): Promise<Votd | null> {
    const day = dayKey();
    const tr = settings.translation;
    const tq = tr ? `&translations=${tr}` : '';
    let saved: Votd | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(VOTD) ?? 'null');
    } catch {
      /* none yet */
    }
    if (saved?.day !== day) saved = null;
    if (saved?.tr === tr) return saved;
    try {
      // today's verse is already chosen: fetch it again in the other translation. Otherwise draw one.
      const d = await this.fetchJson(
        saved ? `https://api.quran.com/api/v4/verses/by_key/${saved.chapter}:${saved.verse}?words=false&fields=text_uthmani${tq}` : `https://api.quran.com/api/v4/verses/random?words=false&fields=text_uthmani${tq}`
      );
      const v = d.verse;
      const [chapter, verse] = String(v.verse_key).split(':').map(Number);
      const out: Votd = { day, chapter, verse, arabic: v.text_uthmani, translation: tr ? plain(v.translations?.[0]?.text ?? '') : '', tr };
      localStorage.setItem(VOTD, JSON.stringify(out));
      return out;
    } catch {
      return saved; // offline: today's verse in whatever language it was saved in
    }
  }

  /** Returns false when the verse could not be loaded (no connection and none saved). */
  async showVerseOfTheDay(): Promise<boolean> {
    const v = await this.verseOfTheDay();
    if (!v) return false;
    const name = player.chapters.find((c) => c.id === v.chapter)?.name_simple ?? `Surah ${v.chapter}`;
    await this.deliver({ kind: 'verse', title: `Verse of the day · ${name} ${v.chapter}:${v.verse}`, body: v.translation, arabic: v.arabic, chapter: v.chapter, verse: v.verse });
    return true;
  }

  /** In front of the reader: a card. Behind other windows or in the tray: the system notification centre too. */
  async deliver(n: Notice) {
    ui.notice = n;
    const active = document.hasFocus() && !document.hidden;
    if (active || !settings.systemNotify) return;
    await this.system(n.title, n.kind === 'verse' ? `${n.arabic ?? ''}\n${n.body}`.trim() : n.body);
  }

  private async system(title: string, body: string) {
    try {
      if (isTauri()) {
        const m = await import('@tauri-apps/plugin-notification');
        let ok = await m.isPermissionGranted();
        if (!ok) ok = (await m.requestPermission()) === 'granted';
        if (ok) m.sendNotification({ title, body });
      } else if ('Notification' in window) {
        if (Notification.permission === 'default') await Notification.requestPermission();
        if (Notification.permission === 'granted') new Notification(title, { body });
      }
    } catch {
      /* notifications are a courtesy; the in-app card still shows */
    }
  }

  /** Said once, the first time the window is closed into the tray, so the app is not mistaken for quit. */
  async trayHint() {
    try {
      if (localStorage.getItem('quran.trayhint')) return;
      localStorage.setItem('quran.trayhint', '1');
    } catch {
      /* storage blocked: it may be said twice */
    }
    await this.system('Quran is still running', 'It stays in the tray so your reminders can arrive. Click the tray icon to open it, or right-click it to quit.');
  }

  /** The Settings "Send a test" button. */
  async test() {
    ui.notice = { kind: 'reminder', title: 'Quran reminder', body: settings.remindMessage || 'Time to read.' };
    if (settings.systemNotify) await this.system('Quran reminder', settings.remindMessage || 'Time to read.');
  }
}

export const notifier = new Notifier();
