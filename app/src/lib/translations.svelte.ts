import { fetchTranslations } from './api';
import type { TranslationInfo } from './types';

const KEY = 'quran.translations';

class Translations {
  list = $state<TranslationInfo[]>([]);
  private started = false;

  constructor() {
    try {
      this.list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    } catch {
      /* none cached yet */
    }
  }

  /** Read the cached list at once, then refresh it from the API once per session. */
  async load() {
    if (this.started) return;
    this.started = true;
    try {
      this.list = await fetchTranslations();
      localStorage.setItem(KEY, JSON.stringify(this.list));
    } catch {
      /* offline: the cached list is enough */
    }
  }

  get grouped() {
    const m = new Map<string, TranslationInfo[]>();
    for (const t of this.list) m.set(t.language, [...(m.get(t.language) ?? []), t]);
    return [...m.entries()].sort((a, b) => (a[0] === 'English' ? -1 : b[0] === 'English' ? 1 : a[0].localeCompare(b[0])));
  }
  name(id: number) {
    return this.list.find((t) => t.id === id)?.name ?? (id === 20 ? 'Saheeh International' : 'Translation');
  }
}

export const translations = new Translations();
