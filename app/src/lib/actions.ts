import { bookmarks } from './bookmarks.svelte';
import { player } from './player.svelte';
import { reader } from './reader.svelte';
import { settings } from './settings.svelte';
import { ui } from './ui.svelte';

/**
 * A word or verse of another surah (on a page shared by two surahs) is played from that surah: it is loaded first,
 * and the reader is told it moved there itself, so it stays on the page that was clicked.
 */
async function inChapter(chapter: number) {
  if (chapter === player.chapter) return;
  reader.selfNav = chapter;
  await player.load(chapter, false);
}

/** Left click on a word: just say it, no menu. */
export async function sayWord(verse: number, pos: number, chapter = player.chapter) {
  ui.pick = null;
  if (!settings.wordAudio) return;
  await inChapter(chapter);
  player.playWord(verse, pos);
}

/** Right click on a word: the menu with its meaning and the play options. */
export function pickWord(verse: number, pos: number, chapter = player.chapter) {
  ui.pick = { chapter, verse, pos };
}

/** Left click on a verse number: play the whole verse, no menu. */
export async function sayVerse(verse: number, chapter = player.chapter) {
  ui.pick = null;
  await inChapter(chapter);
  player.playVerse(verse);
}

/** Right click on a verse number: the menu with the verse options. */
export function pickVerse(verse: number, chapter = player.chapter) {
  ui.pick = { chapter, verse, pos: 0 };
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

/** Back: out of Settings if it is open, otherwise to the previous place in the trail. */
export const goBack = () => (ui.settingsOpen ? ui.closeSettings() : player.navigate(-1));
export const goForward = () => player.navigate(1);
