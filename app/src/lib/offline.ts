import type { ChapterAudio, Verse } from './types';

// Everything needed to read and follow a surah offline lives in IndexedDB:
// text, word timings and the audio blob. Works in the Tauri webview and in a browser.
const DB = 'quran-offline';
const STORES = ['text', 'audio', 'blobs', 'fonts', 'indo'] as const;
type Store = (typeof STORES)[number];

let dbp: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 3);
    req.onupgradeneeded = () => {
      const db = req.result;
      // text cache key changed (now includes the translation), so rebuild that store
      if (db.objectStoreNames.contains('text')) db.deleteObjectStore('text');
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

async function tx<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const audioKey = (reciter: number, chapter: number) => `${reciter}:${chapter}`;

const textKey = (ch: number, tr: number) => `${ch}:${tr}`;
export const getText = (ch: number, tr: number) =>
  tx<Verse[] | undefined>('text', 'readonly', (s) => s.get(textKey(ch, tr)));
export const putText = (ch: number, tr: number, v: Verse[]) => tx('text', 'readwrite', (s) => s.put(v, textKey(ch, tr)));
export const clearAll = async () => {
  for (const store of STORES) await tx(store, 'readwrite', (s) => s.clear());
};
export const blobSizes = async () => {
  const db = await open();
  return new Promise<number>((resolve) => {
    let total = 0;
    const req = db.transaction('blobs').objectStore('blobs').openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve(total);
      total += (c.value as Blob).size;
      c.continue();
    };
    req.onerror = () => resolve(total);
  });
};

export const getAudioMeta = (r: number, ch: number) =>
  tx<ChapterAudio | undefined>('audio', 'readonly', (s) => s.get(audioKey(r, ch)));
export const putAudioMeta = (r: number, ch: number, a: ChapterAudio) =>
  tx('audio', 'readwrite', (s) => s.put(a, audioKey(r, ch)));

export const getBlob = (r: number, ch: number) =>
  tx<Blob | undefined>('blobs', 'readonly', (s) => s.get(audioKey(r, ch)));
export const putBlob = (r: number, ch: number, b: Blob) =>
  tx('blobs', 'readwrite', (s) => s.put(b, audioKey(r, ch)));
export const deleteBlob = (r: number, ch: number) =>
  tx('blobs', 'readwrite', (s) => s.delete(audioKey(r, ch)));
/** Size in bytes of every downloaded recitation, keyed "reciter:chapter". */
export const blobInfo = async () => {
  const db = await open();
  return new Promise<Map<string, number>>((resolve) => {
    const out = new Map<string, number>();
    const req = db.transaction('blobs').objectStore('blobs').openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve(out);
      out.set(String(c.key), (c.value as Blob).size);
      c.continue();
    };
    req.onerror = () => resolve(out);
  });
};
export const listDownloaded = () => tx<IDBValidKey[]>('blobs', 'readonly', (s) => s.getAllKeys());

export const getFont = (page: number) => tx<ArrayBuffer | undefined>('fonts', 'readonly', (s) => s.get(page));
export const putFont = (page: number, b: ArrayBuffer) => tx('fonts', 'readwrite', (s) => s.put(b, page));
export const getIndo = (ch: number) => tx<Record<string, unknown> | undefined>('indo', 'readonly', (s) => s.get(ch));
export const putIndo = (ch: number, v: Record<string, unknown>) => tx('indo', 'readwrite', (s) => s.put(v, ch));
