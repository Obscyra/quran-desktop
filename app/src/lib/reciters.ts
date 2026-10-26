import type { Reciter } from './types';

/** Photo files live on quran.com's image host. */
export const PHOTO_BASE = 'https://static.qurancdn.com/';

// The reciters quran.com offers for whole-surah recitation, with the portrait it shows for each.
// `id` is the recitation id the API takes; `approx` marks recordings that come without word-level
// timings, where the word highlight is spread across each verse instead.
export const RECITERS: Reciter[] = [
  { id: 1, rid: 1, name: "AbdulBaset AbdulSamad", style: "Mujawwad", photo: "images/reciters/1/abdelbasset-profile.jpeg" },
  { id: 2, rid: 1, name: "AbdulBaset AbdulSamad", style: "Murattal", photo: "images/reciters/1/abdelbasset-profile.jpeg" },
  { id: 158, rid: 23, name: "Abdullah Ali Jabir", style: "Murattal", photo: "images/reciters/23/Abdullah-Ali-Jabir-profile.png", approx: true },
  { id: 3, rid: 2, name: "Abdur-Rahman as-Sudais", style: "Murattal", photo: "images/reciters/2/abdul-rahman-al-sudais-profile.jpeg" },
  { id: 4, rid: 3, name: "Abu Bakr al-Shatri", style: "Murattal", photo: "images/reciters/3/abu-bakr-al-shatri-pofile.jpeg" },
  { id: 19, rid: 22, name: "Ahmed ibn Ali al-Ajmy", style: "Murattal", photo: "images/reciters/22/Ahmed-ibn-Ali-al-Ajmy-profile.png", approx: true },
  { id: 160, rid: 24, name: "Bandar Baleela", style: "Murattal", photo: "images/reciters/24/Bandar-Baleela-profile.png", approx: true },
  { id: 5, rid: 4, name: "Hani ar-Rifai", style: "Murattal", photo: "images/reciters/4/hani-ar-rifai-profile.jpeg" },
  { id: 161, rid: 11, name: "Khalifah Al Tunaiji", style: "Murattal", photo: "images/reciters/11/khalifa-al-tunaiji-profile.jpeg" },
  { id: 159, rid: 25, name: "Maher al-Muaiqly", style: "Murattal", photo: "images/reciters/25/Maher-al-Muaiqly-profile.png", approx: true },
  { id: 6, rid: 5, name: "Mahmoud Khalil Al-Husary", style: "Murattal", photo: "images/reciters/5/mahmoud-khalil-al-hussary-profile.png" },
  { id: 7, rid: 6, name: "Mishari Rashid al-`Afasy", style: "Murattal", photo: "images/reciters/6/mishary-rashid-alafasy-profile.jpeg" },
  { id: 9, rid: 7, name: "Mohamed Siddiq al-Minshawi", style: "Murattal", photo: "images/reciters/7/mohamed-siddiq-el-minshawi-profile.jpeg" },
  { id: 13, rid: 12, name: "Sa'ad al-Ghamdi", style: "Murattal", photo: "images/reciters/16/saad-al-ghamdi-profile.png", approx: true },
  { id: 10, rid: 8, name: "Sa'ud ash-Shuraim", style: "Murattal", photo: "images/reciters/8/saoud-shuraim-profile.jpeg" },
  { id: 12, rid: 5, name: "Mahmoud Khalil Al-Husary", style: "Muallim", photo: "images/reciters/5/mahmoud-khalil-al-hussary-profile.png" },
  { id: 173, rid: 6, name: "Mishari Rashid al-`Afasy", style: "Murattal", photo: "images/reciters/6/mishary-rashid-alafasy-profile.jpeg" },
  { id: 168, rid: 7, name: "Mohamed Siddiq al-Minshawi", style: "Kids repeat", photo: "images/reciters/7/mohamed-siddiq-el-minshawi-profile.jpeg" },
  { id: 174, rid: 20, name: "Yasser Ad Dussary", style: "Murattal", photo: "images/reciters/20/yasser-profile.png" }
];
