import type { Reciter } from './types';

/**
 * quranicaudio.com has no portraits. A recitation there by someone quran.com already shows (spelled a little
 * differently) borrows that portrait. Names are the base name, without a [style], (2) or "- Taraweeh" suffix.
 */
const SAME_PERSON: [string, string][] = [
  ["AbdulBaset AbdulSamad", "images/reciters/1/abdelbasset-profile.jpeg"],
  ["Abdullah Ali Jabir", "images/reciters/23/Abdullah-Ali-Jabir-profile.png"],
  ["Abdur-Rahman as-Sudais", "images/reciters/2/abdul-rahman-al-sudais-profile.jpeg"],
  ["Abu Bakr al-Shatri", "images/reciters/3/abu-bakr-al-shatri-pofile.jpeg"],
  ["Ahmed ibn Ali al-Ajmy", "images/reciters/22/Ahmed-ibn-Ali-al-Ajmy-profile.png"],
  ["Bandar Baleela", "images/reciters/24/Bandar-Baleela-profile.png"],
  ["Hani ar-Rifai", "images/reciters/4/hani-ar-rifai-profile.jpeg"],
  ["Khalifah Taniji", "images/reciters/11/khalifa-al-tunaiji-profile.jpeg"],
  ["Maher al-Muaiqly", "images/reciters/25/Maher-al-Muaiqly-profile.png"],
  ["Mahmoud Khaleel Al-Husary", "images/reciters/5/mahmoud-khalil-al-hussary-profile.png"],
  ["Mishari Rashid al-`Afasy", "images/reciters/6/mishary-rashid-alafasy-profile.jpeg"],
  ["Mishari al-`Afasy", "images/reciters/6/mishary-rashid-alafasy-profile.jpeg"],
  ["Muhammad Siddiq al-Minshawi", "images/reciters/7/mohamed-siddiq-el-minshawi-profile.jpeg"],
  ["Saad al-Ghamdi", "images/reciters/16/saad-al-ghamdi-profile.png"],
  ["Sa`ud ash-Shuraym", "images/reciters/8/saoud-shuraim-profile.jpeg"],
  ["Yasser ad-Dussary", "images/reciters/20/yasser-profile.png"]
];
const bare = (n: string) => n.replace(/\s*(\[.*?\]|\(.*?\)|- Taraweeh.*)$/g, '').replace(/\s*(\[.*?\]|\(.*?\)|- Taraweeh.*)$/g, '').trim();
const PHOTOS = new Map(SAME_PERSON);

export const portraitOf = (r: Pick<Reciter, 'name'>) => PHOTOS.get(bare(r.name)) ?? null;
