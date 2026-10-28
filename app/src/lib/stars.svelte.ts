const KEY = 'quran.stars.v1';

/** Surahs the reader has starred; the list shows them first. */
class Stars {
  list = $state<number[]>([]);

  constructor() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (Array.isArray(raw)) this.list = raw.filter((n) => Number.isInteger(n) && n >= 1 && n <= 114);
    } catch {
      /* corrupt: start empty */
    }
  }

  has(chapter: number) {
    return this.list.includes(chapter);
  }
  toggle(chapter: number) {
    this.list = this.has(chapter) ? this.list.filter((n) => n !== chapter) : [...this.list, chapter];
    try {
      localStorage.setItem(KEY, JSON.stringify(this.list));
    } catch {
      /* storage full or blocked */
    }
  }
}

export const stars = new Stars();
