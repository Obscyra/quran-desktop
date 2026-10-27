import { wordLanguage } from './languages';
import { translations } from './translations.svelte';
import { BUNDLED_TRANSLATION, fetchChapterAudio, fetchChapters, fetchIndo, fetchReciters, fetchVerses, isPartial } from './api';
import { autocache } from './autocache.svelte';
import { pageFonts } from './fonts.svelte';
import * as offline from './offline';
import { settings } from './settings.svelte';
import { ui } from './ui.svelte';
import { RECITERS, REMOVED_RECITERS } from './reciters';
import { dim, light, progress } from './sweep';
import type { Chapter, ChapterAudio, Reciter, Verse, WordTiming } from './types';

const LS = { reciter: 'quran.reciter', chapter: 'quran.chapter', verse: 'quran.verse' };
const read = (k: string, d: number) => Number(localStorage.getItem(k) ?? d) || d;
const fromHash = () => {
  const n = Number(location.hash.match(/^#\/(\d+)/)?.[1]);
  return n >= 1 && n <= 114 ? n : 0;
};

class Player {
  chapters = $state<Chapter[]>([]);
  reciters = $state<Reciter[]>([]);
  /** opened on a link to a surah: that wins over the place that was saved */
  private readonly linked = fromHash() > 0;
  chapter = $state(fromHash() || (settings.resume ? read(LS.chapter, 1) : 1));
  reciterId = $state(read(LS.reciter, 7));
  verses = $state<Verse[]>([]);
  audio = $state<ChapterAudio | null>(null);
  playing = $state(false);
  loading = $state(false);
  error = $state('');
  time = $state(0);
  duration = $state(0);
  /** index into audio.timings of the word currently being recited */
  active = $state(-1);
  downloaded = $state(new Set<string>());
  downloading = $state<number | null>(null);
  /** the recitation's details (word timings, file address) are being fetched */
  fetchingAudio = $state(false);
  /** the audio is waiting for data it needs in order to carry on */
  buffering = $state(false);
  get loadingAudio() {
    return this.fetchingAudio || this.buffering;
  }
  /** anything that makes the reader wait on the network */
  get busy() {
    return this.loading || this.loadingAudio;
  }
  /** verse the reader asked to be taken to (a bookmark, a search); the reader consumes it */
  jump = $state<{ verse: number; n: number; mark?: boolean } | null>(null);
  /** verse being repeated, if any */
  loopVerse = $state<number | null>(null);
  /** when set, playback stops (or loops) at `end` instead of running to the end of the surah */
  range: { start: number; end: number; loop: boolean } | null = null;

  private el = new Audio();
  private wordEl = new Audio();
  private raf = 0;
  private objectUrl = '';
  private token = 0;
  private wake: WakeLockSentinel | null = null;

  get current(): Chapter | undefined {
    return this.chapters.find((c) => c.id === this.chapter);
  }
  get activeTiming(): WordTiming | undefined {
    return this.audio?.timings[this.active];
  }
  get isDownloaded() {
    return this.downloaded.has(`${this.reciterId}:${this.chapter}`);
  }
  isChapterDownloaded(ch: number) {
    return this.downloaded.has(`${this.reciterId}:${ch}`);
  }

  async init() {
    this.el.preload = 'auto';
    this.applyVolume();
    this.el.addEventListener('play', () => {
      this.wordEl.pause();
      this.startLoop();
      this.lockScreen();
    });
    // stalls on a slow connection are shown, not left to look like a hang
    for (const ev of ['waiting', 'stalled'] as const) this.el.addEventListener(ev, () => (this.buffering = !this.el.paused && !this.el.ended));
    for (const ev of ['playing', 'canplay', 'error', 'ended', 'emptied'] as const) this.el.addEventListener(ev, () => (this.buffering = false));
    // a recording of quranicaudio.com that has no file for this surah
    this.el.addEventListener('error', () => {
      if (this.audio?.plain && navigator.onLine && this.el.src) this.error = 'This reciter has no recording of this surah. Choose another reciter.';
    });
    this.el.addEventListener('pause', () => {
      this.buffering = false;
      this.playing = false;
      cancelAnimationFrame(this.raf);
      this.wake?.release().catch(() => {});
      this.wake = null;
    });
    this.el.addEventListener('loadedmetadata', () => {
      this.duration = this.el.duration;
      this.applySpeed();
    });
    this.el.addEventListener('ended', () => {
      if (settings.repeatSurah) {
        this.el.currentTime = 0;
        this.el.play().catch(() => {});
      } else if (settings.autoAdvance) this.next(true);
    });
    // a recitation that is no longer offered: move to its replacement and free its saved audio
    if (this.reciterId in REMOVED_RECITERS) {
      this.reciterId = REMOVED_RECITERS[this.reciterId];
      localStorage.setItem(LS.reciter, String(this.reciterId));
    }
    this.refreshDownloads().then(() => this.sweepCache());
    window.setInterval(() => this.sweepCache(), 12 * 3600 * 1000);
    offline
      .listDownloaded()
      .then((keys) => Promise.all(keys.filter((k) => Number(String(k).split(':')[0]) in REMOVED_RECITERS).map((k) => offline.deleteBlob(Number(String(k).split(':')[0]), Number(String(k).split(':')[1])))))
      .then(() => this.refreshDownloads());
    this.refreshDownloads();
    try {
      [this.chapters, this.reciters] = await Promise.all([fetchChapters(), fetchReciters()]);
      localStorage.setItem('quran.chapters', JSON.stringify(this.chapters));
      localStorage.setItem('quran.reciters', JSON.stringify(this.reciters));
    } catch {
      // offline: fall back to the last lists we saw
      this.chapters = JSON.parse(localStorage.getItem('quran.chapters') ?? '[]');
      this.reciters = await fetchReciters(); // never throws: the built-in lists are used offline
    }
    this.trail = [{ chapter: this.chapter, verse: 1 }];
    this.at = 0;
    // read before load(), which forgets the saved verse of the surah it leaves
    const saved = settings.resume && !this.linked ? Number(localStorage.getItem(LS.verse)) : 0;
    await this.load(this.chapter, false);
    if (saved > 1) this.jump = { verse: saved, n: Date.now() };
  }

  /** Remember where the reader is, so the app reopens at the same verse. */
  remember(verse: number) {
    this.lastVerse = verse;
    localStorage.setItem(LS.verse, String(verse));
  }

  async goTo(chapter: number, verse: number) {
    this.record(chapter, verse);
    await this.arrive(chapter, verse);
  }

  /** Move to a place without adding it to the back/forward trail. */
  private async arrive(chapter: number, verse: number) {
    this.replaying = true;
    try {
      if (chapter !== this.chapter) await this.load(chapter, false);
    } finally {
      this.replaying = false;
    }
    this.jump = { verse, n: Date.now(), mark: true };
  }

  /** The back/forward trail: every surah or verse the reader opened, like a browser's history. */
  trail = $state<{ chapter: number; verse: number }[]>([]);
  at = $state(-1);
  private replaying = false;
  private lastVerse = 1;

  get canBack() {
    return this.at > 0;
  }
  get canForward() {
    return this.at < this.trail.length - 1;
  }
  private record(chapter: number, verse = 1) {
    if (this.at >= 0) this.trail[this.at].verse = this.lastVerse;
    this.trail = [...this.trail.slice(0, this.at + 1), { chapter, verse }];
    this.at = this.trail.length - 1;
    this.lastVerse = verse;
  }
  async navigate(delta: -1 | 1) {
    const to = this.at + delta;
    if (to < 0 || to >= this.trail.length) return;
    this.trail[this.at].verse = this.lastVerse;
    this.at = to;
    const t = this.trail[to];
    await this.arrive(t.chapter, t.verse);
  }

  private async refreshDownloads() {
    this.downloaded = new Set((await offline.listDownloaded()).map(String));
    autocache.prune(this.downloaded);
  }

  /** Let go of automatically saved recitations nobody has listened to for a month. */
  async sweepCache() {
    for (const key of autocache.expired()) {
      const [r, ch] = key.split(':').map(Number);
      await offline.deleteBlob(r, ch);
    }
    await this.refreshDownloads();
  }

  private heardMs = 0;
  private heardKey = '';
  private heardCounted = false;
  private heardAt = 0;
  /** After about half a minute of a surah, count it as listened to; a regular one is saved for offline. */
  private trackListening(now: number) {
    const key = `${this.reciterId}:${this.chapter}`;
    if (key !== this.heardKey) {
      this.heardKey = key;
      this.heardMs = 0;
      this.heardCounted = false;
    }
    const dt = now - this.heardAt;
    this.heardAt = now;
    if (dt > 400 || this.heardCounted) return; // a gap means playback was not running
    this.heardMs += dt * this.el.playbackRate;
    if (this.heardMs < 30_000) return;
    this.heardCounted = true;
    const regular = autocache.heard(key);
    if (regular && settings.autoCache && !this.downloaded.has(key) && navigator.onLine && this.progress[key] === undefined && !this.dl.running) {
      const [r, ch] = [this.reciterId, this.chapter];
      this.fetchOne(r, ch)
        .then(() => autocache.mark(key))
        .then(() => this.refreshDownloads())
        .catch(() => {});
    }
  }

  async load(chapter: number, autoplay: boolean) {
    if (!this.replaying && chapter !== this.chapter && this.at >= 0) this.record(chapter);
    const token = ++this.token;
    this.fetchingAudio = false;
    this.buffering = false;
    this.el.pause();
    this.range = null;
    this.loopVerse = null;
    this.chapter = chapter;
    localStorage.setItem(LS.chapter, String(chapter));
    localStorage.removeItem(LS.verse);
    history.replaceState(null, '', `#/${chapter}`);
    this.loading = true;
    this.error = '';
    dim(this.pEl.el);
    this.pEl = { id: '', el: null };
    this.active = -1;
    this.time = 0;
    this.duration = 0;
    try {
      const reciter = this.reciterId;
      const verses = await this.textFor(chapter);
      // audio is only fetched when someone listens; a downloaded copy is picked up for free
      const audio = (await offline.getAudioMeta(reciter, chapter)) ?? null;
      if (token !== this.token) return;
      this.verses = verses;
      this.audio = audio;
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = '';
      if (audio) {
        const blob = await offline.getBlob(reciter, chapter);
        if (token !== this.token) return;
        this.objectUrl = blob ? URL.createObjectURL(blob) : '';
        this.el.src = this.objectUrl || audio.url;
      } else this.el.removeAttribute('src');
      this.preloadFonts(verses);
      setTimeout(() => token === this.token && this.warmNext(), 2500);
      if (autoplay) ui.listening = true; // whatever starts the audio also shows the player
      if (autoplay && (await this.prepareAudio())) await this.el.play();
    } catch (e) {
      if (token === this.token) this.error = navigator.onLine ? 'Could not load this surah.' : 'You are offline and this surah is not downloaded.';
    } finally {
      if (token === this.token) this.loading = false;
    }
  }

  /** Fetch the recitation (word timings and audio address) the first time it is needed. */
  async prepareAudio(): Promise<boolean> {
    if (this.audio) return true;
    const token = this.token;
    this.fetchingAudio = true;
    try {
      const a = await this.fetchAudio(this.reciterId, this.chapter);
      if (token !== this.token) return false;
      this.audio = a;
      this.el.src = a.url;
      return true;
    } catch {
      this.error = navigator.onLine ? 'Could not load the recitation. The connection may be slow.' : 'You are offline. Download this surah to listen offline.';
      return false;
    } finally {
      if (token === this.token) this.fetchingAudio = false;
    }
  }

  /** Recently opened surahs stay in memory, so going back to one (or on to the next) is instant. */
  private memo = new Map<string, Promise<Verse[]>>();
  private lastPartial = false;

  private textFor(ch: number): Promise<Verse[]> {
    const key = `${ch}:${settings.translation}:${settings.needsIndo}`;
    let hit = this.memo.get(key);
    if (!hit) {
      hit = (async () => {
        const tr = settings.translation;
        this.lastPartial = false;
        const base = (await offline.getText(ch, tr)) ?? (await this.fetchText(ch));
        // without its translation (offline): show the Arabic, but ask again next time
        if (this.lastPartial) queueMicrotask(() => this.memo.delete(key));
        return settings.needsIndo ? this.withIndo(ch, base) : base;
      })();
      hit.catch(() => this.memo.delete(key)); // a failed fetch must not be remembered
      this.memo.set(key, hit);
      if (this.memo.size > 8) this.memo.delete(this.memo.keys().next().value!);
    }
    return hit;
  }

  private warmed = '';
  /** While a surah plays, get the next one ready: its text, fonts and recitation timings. */
  private warmNext() {
    const ch = this.chapter + 1;
    const key = `${ch}:${this.reciterId}`;
    if (ch > 114 || this.warmed === key || !navigator.onLine) return;
    this.warmed = key;
    this.textFor(ch).then((v) => this.preloadFonts(v)).catch(() => {});
    offline.getAudioMeta(this.reciterId, ch).then((m) => m ?? this.fetchAudio(this.reciterId, ch)).catch(() => {});
  }

  private async withIndo(ch: number, verses: Verse[]): Promise<Verse[]> {
    let map = (await offline.getIndo(ch)) as Record<string, { text: string; page: number; line: number }> | undefined;
    if (!map) {
      map = await fetchIndo(ch);
      offline.putIndo(ch, map).catch(() => {});
    }
    const m = map;
    return verses.map((v) => ({ ...v, words: v.words.map((w) => ({ ...w, indo: m[`${v.n}-${w.pos}`] })) }));
  }

  private preloadFonts(verses: Verse[]) {
    if (settings.script !== 'mushaf') return;
    const pages = new Set<number>();
    for (const v of verses) {
      for (const w of v.words) pages.add(w.gp);
      pages.add(v.endPage);
    }
    pageFonts.ensure(pages);
  }

  private async fetchText(ch: number) {
    const tr = settings.translation;
    const v = await fetchVerses(ch, tr, wordLanguage(translations.list.find((x) => x.id === tr)?.language));
    // the bundled text is already on disk; a translation that could not be fetched must not be remembered as empty
    if (tr !== BUNDLED_TRANSLATION && !isPartial(v)) offline.putText(ch, tr, v);
    this.lastPartial = isPartial(v);
    return v;
  }
  private async fetchAudio(r: number, ch: number) {
    const a = await fetchChapterAudio(r, ch);
    // some recordings only come with verse boundaries: spread each verse over its words by length
    if (!a.timings.length && a.spans?.length) {
      const verses = ch === this.chapter && this.verses.length ? this.verses : await this.textFor(ch);
      for (const sp of a.spans) {
        const ws = verses.find((v) => v.n === sp.verse)?.words ?? [];
        const weight = ws.map((w) => Math.max(1, [...w.text.normalize('NFD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')].length));
        const total = weight.reduce((x, y) => x + y, 0) || 1;
        let t = sp.start;
        ws.forEach((w, i) => {
          const d = ((sp.end - sp.start) * weight[i]) / total;
          a.timings.push({ verse: sp.verse, pos: w.pos, start: Math.round(t), end: Math.round(t + d) });
          t += d;
        });
      }
      a.approx = true;
    }
    offline.putAudioMeta(r, ch, a);
    return a;
  }

  applyVolume() {
    this.el.volume = Math.min(1, Math.max(0, settings.volume));
  }

  applySpeed() {
    this.el.playbackRate = settings.speed;
    this.el.preservesPitch = true;
  }

  /** Re-read the surah text, e.g. after the translation changed. Keeps playback going. */
  async refreshText() {
    const token = this.token;
    try {
      const v = await this.textFor(this.chapter);
      if (token !== this.token) return;
      this.verses = v;
      this.preloadFonts(v);
    } catch {
      this.error = 'Could not load that translation. It will work once you are online.';
    }
  }

  private async lockScreen() {
    if (!settings.keepAwake || !('wakeLock' in navigator) || this.wake) return;
    try {
      this.wake = await navigator.wakeLock.request('screen');
    } catch {
      /* not allowed in this context; harmless */
    }
  }

  /** Resolve once the audio element knows its length, so a seek on a freshly loaded file sticks. */
  private whenReady() {
    if (this.el.readyState >= 1) return Promise.resolve();
    return new Promise<void>((res) => {
      const done = () => {
        this.el.removeEventListener('loadedmetadata', done);
        res();
      };
      this.el.addEventListener('loadedmetadata', done);
      setTimeout(done, 8000); // never hang on a slow connection
    });
  }

  /**
   * Switch reciter and carry on from the same place. If the old reciter had just finished a verse
   * (say verses 1–5), the new one starts at the next verse (6), not at the beginning.
   */
  async setReciter(id: number) {
    if (id === this.reciterId) return;
    this.tick(); // bring the current word up to date with the audio clock
    const cur = this.activeTiming;
    const was = !this.el.paused;
    let target = cur ? { verse: cur.verse, pos: cur.pos } : null;
    if (cur && this.audio) {
      const vt = this.audio.timings.filter((x) => x.verse === cur.verse);
      const lastWord = vt[vt.length - 1] === cur;
      const done = (this.el.currentTime * 1000 - cur.start) / Math.max(1, cur.end - cur.start) > 0.8;
      if (lastWord && done && cur.verse < this.verses.length) target = { verse: cur.verse + 1, pos: 1 };
    }
    this.reciterId = id;
    localStorage.setItem(LS.reciter, String(id));
    await this.load(this.chapter, false);
    if (!target || !(await this.prepareAudio())) return;
    const t = this.audio?.timings ?? [];
    const at = t.find((x) => x.verse === target.verse && x.pos === target.pos) ?? t.find((x) => x.verse === target.verse);
    if (!at) return;
    await this.whenReady();
    this.jumpTo(at.start);
    if (was) {
      this.playing = true;
      this.el.play().catch(() => (this.playing = false));
    }
  }

  async toggle() {
    ui.listening = true;
    if (this.el.paused) {
      this.playing = true;
      if (!(await this.prepareAudio())) return void (this.playing = false);
      this.el.play().catch(() => (this.playing = false));
    } else this.el.pause();
  }
  /** Close the listening bar and stop. */
  stop() {
    this.el.pause();
    this.wordEl.pause();
    this.range = null;
    this.loopVerse = null;
    ui.listening = false;
  }
  next(autoplay = this.playing) {
    if (this.chapter < 114) this.load(this.chapter + 1, autoplay);
  }
  prev() {
    if (this.chapter > 1) this.load(this.chapter - 1, this.playing);
  }
  seek(ms: number) {
    this.range = null;
    this.loopVerse = null;
    this.jumpTo(ms);
  }
  private jumpTo(ms: number) {
    this.lastCt = -1;
    this.el.currentTime = ms / 1000;
    this.tick();
  }

  private verseSpan(n: number): { start: number; end: number } | null {
    const t = this.audio?.timings;
    if (!t?.length) return null;
    let start = Infinity;
    let end = 0;
    let next = Infinity;
    for (const x of t) {
      if (x.verse === n) {
        start = Math.min(start, x.start);
        end = Math.max(end, x.end);
      } else if (x.verse === n + 1) next = Math.min(next, x.start);
    }
    if (!isFinite(start)) return null;
    return { start, end: isFinite(next) ? next : end + 300 };
  }

  /** Play one verse and stop (or keep repeating it). */
  async playVerse(n: number, loop = false) {
    ui.listening = true;
    if (!(await this.prepareAudio())) return;
    const span = this.verseSpan(n);
    if (!span) return this.wholeSurahOnly();
    this.range = { ...span, loop };
    this.loopVerse = loop ? n : null;
    this.jumpTo(span.start);
    this.playing = true;
    this.el.play().catch(() => (this.playing = false));
  }

  /** A recording without timings cannot start at a verse or a word. */
  private wholeSurahOnly() {
    // a small notice: an error here would replace the surah on screen
    if (this.audio?.plain) ui.notice = { kind: 'info', title: 'This reciter plays whole surahs', body: 'To start from a verse or a word, choose a reciter from the Follow along group.' };
  }

  /** Play on from a word to the end of the surah. */
  async playFrom(n: number, pos: number) {
    ui.listening = true;
    if (!(await this.prepareAudio())) return;
    const t = this.audio?.timings.find((x) => x.verse === n && x.pos === pos);
    if (!t) return this.wholeSurahOnly();
    this.range = null;
    this.loopVerse = null;
    this.jumpTo(t.start);
    this.playing = true;
    this.el.play().catch(() => (this.playing = false));
  }

  /** Say one word. Uses the word recording when online, or the surah audio when it is downloaded. */
  async playWord(n: number, pos: number) {
    const w = this.verses.find((v) => v.n === n)?.words.find((x) => x.pos === pos);
    if (!w) return;
    this.el.pause();
    this.range = null;
    this.loopVerse = null;
    const t = this.audio?.timings.find((x) => x.verse === n && x.pos === pos);
    if ((!navigator.onLine || !w.aud) && t) {
      this.range = { start: t.start, end: t.end + 120, loop: false };
      this.jumpTo(t.start);
      this.playing = true;
      this.el.play().catch(() => (this.playing = false));
      return;
    }
    if (!w.aud) return;
    this.wordEl.volume = Math.min(1, Math.max(0, settings.volume));
    this.wordEl.src = `https://audio.qurancdn.com/${w.aud}`;
    this.wordEl.play().catch(() => {});
  }
  /** Jump to the start of the verse before (+1) or after (-1) the one being recited. */
  seekVerse(delta: number) {
    const timings = this.audio?.timings;
    if (!timings?.length) return;
    const cur = this.activeTiming?.verse ?? 1;
    const target = Math.max(1, cur - delta);
    const t = timings.find((x) => x.verse === target);
    if (t) this.seek(t.start);
  }
  /** Step to the next (+1) or previous (-1) verse; a verse-only play carries on in the same way. */
  async stepVerse(delta: -1 | 1) {
    if (!(await this.prepareAudio())) return;
    if (this.audio?.plain) return this.wholeSurahOnly();
    const cur = this.activeTiming?.verse ?? 1;
    const target = Math.min(this.verses.length, Math.max(1, cur + delta));
    if (target === cur && delta > 0) return;
    if (this.range) return this.playVerse(target, !!this.range.loop);
    const t = this.audio?.timings.find((x) => x.verse === target);
    if (t) this.seek(t.start);
  }
  seekFraction(f: number) {
    this.seek(f * this.duration * 1000);
  }

  /** Save one surah for one reciter: text, fonts, word timings and the audio itself. */
  private async fetchOne(r: number, ch: number, signal?: AbortSignal) {
    const verses = await this.textFor(ch);
    this.preloadFonts(verses);
    const a = (await offline.getAudioMeta(r, ch)) ?? (await this.fetchAudio(r, ch));
    if (await offline.getBlob(r, ch)) return;
    const key = `${r}:${ch}`;
    this.progress[key] = 0;
    try {
      const res = await fetch(a.url, { signal });
      if (!res.ok) throw new Error(String(res.status));
      const total = Number(res.headers.get('content-length')) || 0;
      if (!res.body || !total) {
        this.progress[key] = -1; // size unknown: no percentage to show
        await offline.putBlob(r, ch, await res.blob());
        return;
      }
      // read it in pieces so the percentage can move
      const reader = res.body.getReader();
      const parts: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        this.progress[key] = Math.min(0.99, got / total);
      }
      await offline.putBlob(r, ch, new Blob(parts as BlobPart[], { type: res.headers.get('content-type') ?? 'audio/mpeg' }));
    } finally {
      delete this.progress[key];
    }
  }

  /** How much of a surah's audio has arrived while it downloads, 0 to 1, by "reciter:surah". */
  progress = $state<Record<string, number>>({});
  /** 0 to 1 for the surah in the player right now, or null when it is not downloading */
  get chapterProgress(): number | null {
    return this.progress[`${this.reciterId}:${this.chapter}`] ?? null;
  }
  /** overall progress of a bulk download, 0 to 1 */
  get bulkProgress(): number {
    const { total, done, reciter } = this.dl;
    if (!total) return 0;
    const part = this.dl.current.reduce((t, ch) => t + Math.max(0, this.progress[`${reciter}:${ch}`] ?? 0), 0);
    return Math.min(1, (done + part) / total);
  }

  /** Progress of the download manager (bulk or single downloads for any reciter). */
  dl = $state({ reciter: 0, total: 0, done: 0, failed: 0, running: false, current: [] as number[] });
  private dlCancel = false;
  private dlAbort: AbortController | null = null;

  async downloadMany(reciter: number, chapters: number[]) {
    if (this.dl.running || !chapters.length) return;
    this.dlCancel = false;
    this.dlAbort = new AbortController();
    const signal = this.dlAbort.signal;
    for (const ch of chapters) autocache.release(`${reciter}:${ch}`); // asked for by hand: keep them
    this.dl = { reciter, total: chapters.length, done: 0, failed: 0, running: true, current: [] };
    const queue = [...chapters];
    const worker = async () => {
      for (let ch = queue.shift(); ch !== undefined && !this.dlCancel; ch = queue.shift()) {
        this.dl.current = [...this.dl.current, ch];
        try {
          await this.fetchOne(reciter, ch, signal);
        } catch {
          if (!this.dlCancel) this.dl.failed++; // a stopped download is not a failure
        }
        this.dl.done++;
        this.dl.current = this.dl.current.filter((x) => x !== ch);
        await this.refreshDownloads();
      }
    };
    await Promise.all([worker(), worker()]); // two at a time: quick, but kind to the server
    this.dl.running = false;
  }
  cancelDownloads() {
    this.dlCancel = true;
    this.dlAbort?.abort(); // also cuts the surahs still downloading, so Stop is immediate
  }
  isDownloadedFor(r: number, ch: number) {
    return this.downloaded.has(`${r}:${ch}`);
  }
  async removeAudio(r: number, ch: number) {
    await offline.deleteBlob(r, ch);
    await this.refreshDownloads();
  }
  async removeAllFor(r: number) {
    for (const k of this.downloaded) if (k.startsWith(`${r}:`)) await offline.deleteBlob(r, Number(k.split(':')[1]));
    await this.refreshDownloads();
  }

  async download() {
    if (this.downloading) return;
    autocache.release(`${this.reciterId}:${this.chapter}`); // asked for by hand: keep it
    this.downloading = this.chapter;
    const [r, ch] = [this.reciterId, this.chapter];
    try {
      await this.fetchOne(r, ch);
      await this.refreshDownloads();
    } catch {
      this.error = 'Download failed. Check your connection and try again.';
    } finally {
      this.downloading = null;
    }
  }
  async removeDownload() {
    await offline.deleteBlob(this.reciterId, this.chapter);
    await this.refreshDownloads();
  }

  private startLoop() {
    this.playing = true;
    const frame = () => {
      this.tick();
      this.raf = requestAnimationFrame(frame);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(frame);
  }

  /** Find the word being recited and push sweep progress straight to the DOM (no reactive churn at 60fps). */
  private lastCt = -1;
  private lastStamp = 0;
  private pEl: { id: string; el: HTMLElement | null } = { id: '', el: null };

  private tick() {
    // The media clock moves in coarse steps (often 50–250 ms in a webview), which made the highlight
    // trail the voice. Between steps, carry the time forward with the wall clock, and lead slightly
    // to make up for the audio output delay.
    const ct = this.el.currentTime;
    const now = performance.now();
    if (ct !== this.lastCt) {
      this.lastCt = ct;
      this.lastStamp = now;
    }
    let t = ct * 1000;
    if (!this.el.paused) {
      t += Math.min(250, (now - this.lastStamp) * this.el.playbackRate) + 40;
      this.trackListening(now);
    } else this.heardAt = 0;
    const timings = this.audio?.timings;
    if (!timings?.length) {
      // a whole-surah recording without timings: only the clock and the seek bar move
      if (Math.abs(ct - this.time) >= 0.1 || ct < this.time) this.time = ct;
      if (this.duration && ct / this.duration > 0.75) this.warmNext();
      return;
    }
    let lo = 0;
    let hi = timings.length - 1;
    let idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (timings[mid].start <= t) {
        idx = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (idx >= 0) {
      const w = timings[idx];
      const id = `w-${w.verse}-${w.pos}`;
      if (this.pEl.id !== id || !this.pEl.el?.isConnected) {
        dim(this.pEl.el);
        this.pEl = { id, el: document.getElementById(id) };
        if (this.pEl.el) light(this.pEl.el);
      }
      progress(Math.min(1, Math.max(0, (t - w.start) / Math.max(1, w.end - w.start))));
    } else if (this.pEl.el) {
      dim(this.pEl.el);
      this.pEl = { id: '', el: null };
    }
    if (idx !== this.active) this.active = idx;
    // the clock readout and seek bar do not need 60 updates a second
    if (Math.abs(ct - this.time) >= 0.1 || ct < this.time) this.time = ct;
    if (this.duration && ct / this.duration > 0.75) this.warmNext();
    const r = this.range;
    if (r && t >= r.end) {
      if (r.loop) this.jumpTo(r.start);
      else {
        this.range = null;
        this.el.pause();
      }
    }
  }
}

export const player = new Player();
