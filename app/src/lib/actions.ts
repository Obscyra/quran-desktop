import { bookmarks } from './bookmarks.svelte';
import { player } from './player.svelte';
import { settings } from './settings.svelte';
import { ui } from './ui.svelte';

/** Left click on a word: just say it, no menu. */
export function sayWord(verse: number, pos: number) {
  ui.pick = null;
  if (settings.wordAudio) player.playWord(verse, pos);
}

/** Right click on a word: the menu with its meaning and the play options. */
export function pickWord(verse: number, pos: number) {
  ui.pick = { chapter: player.chapter, verse, pos };
}

/** A verse-end marker or a verse number was tapped. */
export function pickVerse(verse: number) {
  ui.pick = { chapter: player.chapter, verse, pos: 0 };
}

export const closePick = () => (ui.pick = null);

export function verseText(verse: number) {
  const v = player.verses.find((x) => x.n === verse);
  if (!v) return '';
  const ch = player.current;
  const arabic = v.words.map((w) => (settings.script === 'indopak' && w.indo ? w.indo.text : w.text)).join(' ');
  const ref = `${ch?.name_simple ?? player.chapter} ${player.chapter}:${verse}`;
  return [arabic, v.translation, `— ${ref}`].filter(Boolean).join('\n');
}

export async function copyVerse(verse: number) {
  try {
    await navigator.clipboard.writeText(verseText(verse));
    return true;
  } catch {
    return false;
  }
}

export const toggleBookmark = (verse: number) => bookmarks.toggle(player.chapter, verse);
