export interface Bookmark {
  chapter: number;
  verse: number;
  note: string;
  at: number;
}

const KEY = 'quran.bookmarks.v1';

class Bookmarks {
  list = $state<Bookmark[]>([]);

  constructor() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (Array.isArray(raw)) this.list = raw.filter((b) => b && b.chapter > 0 && b.verse > 0);
    } catch {
      /* corrupt: start empty */
    }
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.list));
    } catch {
      /* storage full or blocked */
    }
  }

  has(chapter: number, verse: number) {
    return this.list.some((b) => b.chapter === chapter && b.verse === verse);
  }
  get(chapter: number, verse: number) {
    return this.list.find((b) => b.chapter === chapter && b.verse === verse);
  }
  toggle(chapter: number, verse: number) {
    if (this.has(chapter, verse)) this.list = this.list.filter((b) => !(b.chapter === chapter && b.verse === verse));
    else this.list = [{ chapter, verse, note: '', at: Date.now() }, ...this.list];
    this.save();
  }
  setNote(chapter: number, verse: number, note: string) {
    this.list = this.list.map((b) => (b.chapter === chapter && b.verse === verse ? { ...b, note } : b));
    this.save();
  }

  export() {
    return JSON.stringify({ app: 'quran-desktop', version: 1, bookmarks: this.list }, null, 2);
  }
  /** Merge a previously exported file. Returns how many bookmarks were added. */
  import(text: string) {
    const data = JSON.parse(text);
    const incoming: Bookmark[] = Array.isArray(data) ? data : data.bookmarks;
    let added = 0;
    for (const b of incoming ?? []) {
      if (!(b?.chapter >= 1 && b.chapter <= 114 && b?.verse >= 1) || this.has(b.chapter, b.verse)) continue;
      this.list = [...this.list, { chapter: b.chapter, verse: b.verse, note: String(b.note ?? ''), at: Number(b.at) || Date.now() }];
      added++;
    }
    this.list = [...this.list].sort((a, b) => b.at - a.at);
    this.save();
    return added;
  }
}

export const bookmarks = new Bookmarks();
