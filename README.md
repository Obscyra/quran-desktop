<div align="center">

<img src="app/src-tauri/icons/128x128.png" alt="Quran for Desktop" width="110"/>

# Quran for Desktop

**A free, open-source, ad-free Quran app for Windows, macOS and Linux.**<br/>
Read the printed Mushaf, follow the recitation word by word, and keep reading with no internet.

[![License: GPL v3](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/Obscyra/quran-desktop?include_prereleases&label=release)](https://github.com/Obscyra/quran-desktop/releases/latest)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-555)](#download)

<p align="center">
  <a href="https://github.com/Obscyra/quran-desktop/releases/latest"><img src="docs/readme/btn-windows.svg" alt="Download for Windows" height="64"></a>
  <a href="https://github.com/Obscyra/quran-desktop/releases/latest"><img src="docs/readme/btn-macos.svg" alt="Download for macOS" height="64"></a>
</p>
<p align="center">
  <a href="https://github.com/Obscyra/quran-desktop/releases/latest"><img src="docs/readme/btn-linux-appimage.svg" alt="Download AppImage for Linux" height="64"></a>
  <a href="https://github.com/Obscyra/quran-desktop/releases/latest"><img src="docs/readme/btn-linux-deb.svg" alt="Download deb for Linux" height="64"></a>
  <a href="https://github.com/Obscyra/quran-desktop/releases/latest"><img src="docs/readme/btn-linux-rpm.svg" alt="Download rpm for Linux" height="64"></a>
</p>

<sub>Buttons open the newest release; all files are on the <a href="https://github.com/Obscyra/quran-desktop/releases/latest">Releases page</a> · <a href="https://qurandesktop.netlify.app">Website</a></sub>

<img src="assets/screenshots/verse-by-verse-playing.webp" alt="Verse by Verse view with word-by-word meanings and the recited word highlighted" width="900"/>

</div>

## Download

Use the buttons above, or pick a file from the [Releases page](https://github.com/Obscyra/quran-desktop/releases/latest).

- **Windows 10 / 11:** installs for your user only, no administrator rights needed. SmartScreen may warn because the installer isn't code-signed yet: choose **More info → Run anyway**.
- **macOS:** one build for Apple silicon and Intel. On first launch, right-click the app and choose **Open**.
- **Linux (x86_64):** the AppImage runs on most distributions (`chmod +x`, then run) and updates itself. The `.deb` is for Debian and Ubuntu, the `.rpm` for Fedora and openSUSE; these two don't update themselves. On GNOME the tray icon needs the AppIndicator extension.

This is a beta, and the macOS and Linux builds haven't been tested much on real machines yet. Please report anything that looks wrong, especially in the Arabic text, with the [Arabic text report form](https://github.com/Obscyra/quran-desktop/issues/new?template=arabic-text.yml). New versions are offered inside the app (Settings → Updates).

## Features

**What's new in 0.0.10-beta**
- A redesigned look: one calm frame for the title bar and sidebar, new icons, restyled menus and dialogs, and a clearer Verse by Verse / Reading switch.
- **Calligraphic surah frames** on the first page of every surah, in the Madinah, Ottoman or IndoPak style to match your theme.
- Simpler Settings in seven areas, with related options merged and your earlier choices carried over.

**Reading**
- *Verse by Verse* with translation and tools, or *Reading* the printed Mushaf as a two-page spread, single pages or one long scroll.
- Every page drawn in its own per-page font, so lines match the printed Madani Mushaf. Madani and IndoPak page layouts.
- Seven script styles, including colour-coded Tajweed.
- Bookmarks with notes, jump to any verse by typing `55:13`, and the app reopens where you left off.

**Listening**
- 17 reciters with word-by-word tracking that follows the recitation, plus 90+ more to listen to surah by surah.
- Play one word or one verse, with speed control, repeat and automatic next surah.
- Media keys and, on Windows, taskbar buttons work with the window closed.

**Translation and tafsir**
- 100+ translations, transliteration, and word-by-word meanings in the translation's language.
- Tafsir verse by verse: choose a commentary edition, and open it only where you want it.

**Offline**
- The full Arabic text and all 604 page fonts are inside the installer, so reading needs no connection. Once a week, while online, the app checks for corrections and applies them.
- An Offline manager saves audio and tafsir by surah.

**Comfort**
- Fifteen themes (ten dark, five light), interface size from 50% to 200%, full screen, and a player bar that opens on demand.
- Runs in the system tray with optional reminders and the Verse of the Day.
- No ads, no accounts, no paid features, no tracking.

The full list, with keyboard shortcuts, is in [docs/FEATURES.md](docs/FEATURES.md).

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="assets/screenshots/reading-spread.webp" alt="Two-page Madani Mushaf spread in the White and Gold theme"/><br/><sub><b>Reading</b> a two-page Madani Mushaf spread (White &amp; Gold)</sub></td>
    <td width="50%"><img src="assets/screenshots/theme-night.webp" alt="Verse by Verse in the dark Night theme"/><br/><sub><b>Night</b> theme, Verse by Verse with the translation</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="assets/screenshots/audio-manager.webp" alt="Offline manager: choose a reciter, download or delete surahs"/><br/><sub><b>Offline manager:</b> choose a reciter, then download or delete surahs</sub></td>
    <td width="50%"><img src="assets/screenshots/settings.webp" alt="Settings organised into eight pages, with search and per-setting reset"/><br/><sub><b>Settings</b>, organised into eight pages, with search and a Reset on each setting</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="assets/screenshots/theme-gold.webp" alt="Verse by Verse in the White and Gold theme"/><br/><sub><b>White &amp; Gold</b> theme</sub></td>
    <td width="50%"><img src="assets/screenshots/compact-window.webp" alt="The app in a small window with the player bar"/><br/><sub><b>Small window:</b> everything still fits, player bar included</sub></td>
  </tr>
</table>

## Themes

Fifteen themes: ten dark and five light, or follow your system. The dark ones avoid pure black and pure white, which is harsher on the eyes in a dim room, and every colour pair is checked for contrast. Change the theme in Settings → Appearance.

<table>
  <tr>
    <td width="33%"><img src="assets/screenshots/themes/night.webp" alt="Verse by Verse in the Night theme"/><br/><sub><b>Night</b></sub></td>
    <td width="33%"><img src="assets/screenshots/themes/tahajjud.webp" alt="Verse by Verse in the Tahajjud theme"/><br/><sub><b>Tahajjud</b></sub></td>
    <td width="33%"><img src="assets/screenshots/themes/tide.webp" alt="Verse by Verse in the Tide theme"/><br/><sub><b>Tide</b></sub></td>
  </tr>
  <tr>
    <td width="33%"><img src="assets/screenshots/themes/fjord.webp" alt="Verse by Verse in the Fjord theme"/><br/><sub><b>Fjord</b></sub></td>
    <td width="33%"><img src="assets/screenshots/themes/graphite.webp" alt="Verse by Verse in the Graphite theme"/><br/><sub><b>Graphite</b></sub></td>
    <td width="33%"><img src="assets/screenshots/themes/moss.webp" alt="Verse by Verse in the Moss theme"/><br/><sub><b>Moss</b></sub></td>
  </tr>
  <tr>
    <td width="33%"><img src="assets/screenshots/themes/sidr.webp" alt="Verse by Verse in the Sidr theme"/><br/><sub><b>Sidr</b></sub></td>
    <td width="33%"><img src="assets/screenshots/themes/rosewood.webp" alt="Verse by Verse in the Rosewood theme"/><br/><sub><b>Rosewood</b></sub></td>
    <td width="33%"><img src="assets/screenshots/themes/forest.webp" alt="Verse by Verse in the Madinah theme"/><br/><sub><b>Madinah</b></sub></td>
  </tr>
  <tr>
    <td width="33%"><img src="assets/screenshots/themes/slate.webp" alt="Verse by Verse in the Slate theme"/><br/><sub><b>Slate</b></sub></td>
    <td width="33%"><img src="assets/screenshots/themes/paper.webp" alt="Verse by Verse in the Paper theme"/><br/><sub><b>Paper</b></sub></td>
    <td width="33%"><img src="assets/screenshots/themes/gold.webp" alt="Verse by Verse in the White and Gold theme"/><br/><sub><b>White &amp; Gold</b></sub></td>
  </tr>
  <tr>
    <td width="33%"><img src="assets/screenshots/themes/stone.webp" alt="Verse by Verse in the Stone theme"/><br/><sub><b>Stone</b></sub></td>
    <td width="33%"><img src="assets/screenshots/themes/sage.webp" alt="Verse by Verse in the Sage theme"/><br/><sub><b>Sage</b></sub></td>
    <td width="33%"><img src="assets/screenshots/themes/rosewater.webp" alt="Verse by Verse in the Rosewater theme"/><br/><sub><b>Rosewater</b></sub></td>
  </tr>
</table>

## Privacy

There are no accounts, no analytics and no tracking. The app talks to the [Quran.com](https://quran.com) API and its audio hosts only to fetch audio, translations other than the bundled one, tafsir, the reciter list, and the Verse of the Day. Bookmarks, settings and downloads stay on your computer.

## Build from source

You need [Node.js 22+](https://nodejs.org) and Rust (see the [Tauri prerequisites](https://tauri.app/start/prerequisites/)).

```bash
git clone https://github.com/Obscyra/quran-desktop.git
cd quran-desktop/app
npm install
npm run bundle        # once: downloads the Quran text and page fonts (about 120 MB) that ship with the app

npx vite dev --port 1420   # the interface alone, in a browser at http://localhost:1420
npm run tauri dev          # the desktop app, with hot reload
npm run check              # type check
npm run tauri build        # an installer for your system
```

**Tech stack:** [Tauri 2](https://tauri.app) (Rust) with [SvelteKit](https://svelte.dev/docs/kit), Svelte 5 and TypeScript. Text, word timings and audio come from the Quran.com API; downloads are kept in IndexedDB.

## Contributing

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Want a feature? [Request it here](https://github.com/Obscyra/quran-desktop/issues/new?template=feature.yml). Found a security problem? See [SECURITY.md](SECURITY.md).

## Credits

- **Data and audio:** the [Quran.com](https://quran.com) / [Quran.Foundation](https://quran.foundation) public API (v4), and the audio hosts it points to such as [quranicaudio.com](https://quranicaudio.com).
- **Mushaf fonts, tajweed markup and IndoPak text:** Quran.com and the King Fahd Quran Printing Complex.
- **Other Arabic fonts** (SIL Open Font License, bundled): [Amiri Quran](https://github.com/aliftype/amiri-quran), [Scheherazade New](https://software.sil.org/scheherazade/) and [Noto Naskh Arabic](https://fonts.google.com/noto/specimen/Noto+Naskh+Arabic).
- **Bengali text font** (SIL Open Font License, bundled in WOFF2 and TrueType formats): [Noto Sans Bengali](https://fonts.google.com/noto/specimen/Noto+Sans+Bengali).
- **Inspiration:** this app was built by studying [Quran for Android](https://github.com/quran/quran_android), the open-source app by the Quran.com community. It is an independent project written from scratch in TypeScript and Rust. Looking for the Android app? It is on [Google Play](https://play.google.com/store/apps/details?id=com.quran.labs.androidquran) and [IzzyOnDroid](https://apt.izzysoft.de/packages/com.quran.labs.androidquran).
- **Open-source projects used:** [Tauri](https://tauri.app), [Svelte](https://svelte.dev) and [SvelteKit](https://svelte.dev/docs/kit), [Vite](https://vite.dev).

May Allah reward everyone who has helped make the Quran freely available.

## License

The source code is licensed under the [GPL-3.0](LICENSE): modifications must be open-sourced too.

The Quran text, fonts and audio are not covered by that licence. They come from Quran.com and other sources under their own terms, often non-commercial ones, so check each before redistributing them. This project exists to serve the ummah, and the maintainer asks that forks stay free of ads and in-app purchases.
