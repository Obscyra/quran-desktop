<div align="center">

<img src="assets/icon.png" alt="Quran for Desktop" width="120"/>

# Quran for Desktop

**A free, open-source Quran app for Windows, macOS and Linux.**<br/>
Read the exact printed Mushaf, follow the recitation word by word, and read with no internet at all.

[![Latest release](https://img.shields.io/github/v/release/Obscyra/quran-desktop?style=for-the-badge&color=2ea44f&label=Download)](https://github.com/Obscyra/quran-desktop/releases/latest)

[![Downloads](https://img.shields.io/github/downloads/Obscyra/quran-desktop/total)](https://github.com/Obscyra/quran-desktop/releases)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-555)](#download)
[![License: GPL v3](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE)

<img src="assets/screenshots/verse-by-verse-playing.webp" alt="Verse by Verse view with word-by-word meanings and the recited word highlighted" width="900"/>

</div>

<br/>

## Why this app

- **Reading comes first.** It opens as a Quran to read. Listening is one click away and never in the way.
- **The real Mushaf.** Every page is drawn in its own per-page font, so each line matches the printed Madani Mushaf glyph for glyph.
- **Works offline from the first launch.** The full Arabic text and all 604 page fonts are inside the installer. Only audio and other translations need a connection, and audio can be downloaded for later. Once a week the app checks for corrections to the text and fonts and applies them.
- **Free for good.** No ads, no accounts, no paid features, no tracking.

Website: **[qurandesktop.netlify.app](https://qurandesktop.netlify.app)**, with a live demo of the reader.

Compared with the [quran.com](https://quran.com) website, this is a native desktop app that keeps working without a connection and runs quietly in the tray.

## Download

Get the installer for your system from the **[latest release](https://github.com/Obscyra/quran-desktop/releases/latest)**.

| System | File | Notes |
| --- | --- | --- |
| Windows 10 / 11 | `Quran_<version>_x64-setup.exe` (about 100 MB) | Installs for your user only, no administrator rights needed. Windows SmartScreen may warn because the app is not code-signed yet: choose **More info → Run anyway**. |
| macOS | `Quran_<version>_universal.dmg` | Built automatically for Apple silicon and Intel. Not yet tested on a Mac by the maintainer. |
| Linux (x86_64) | `Quran_<version>_amd64.AppImage`, `.deb` or `.rpm` | The AppImage runs on most distributions (`chmod +x`, then run) and updates itself; the `.deb` is for Debian and Ubuntu and the `.rpm` for Fedora and openSUSE (these two do not update themselves). Not yet tested on a Linux desktop by the maintainer. On GNOME the tray icon needs the AppIndicator extension. |

> **This is a beta.** Please report anything that looks wrong, especially in the Arabic text, with the
> [Arabic text report form](https://github.com/Obscyra/quran-desktop/issues/new?template=arabic-text.yml).

New versions are offered inside the app (Settings → Updates).

## Highlights

- **Two ways to read:** *Verse by Verse* with translation and tools, or *Reading* the printed Mushaf as a two-page spread, single pages or one long scroll.
- **Seven script styles**, including colour-coded Tajweed, and the Madani and IndoPak page layouts.
- **100+ translations**, with word-by-word meanings in the translation's language, and transliteration.
- **17 reciters** with word-by-word tracking that follows the recitation, plus **90+ more** to listen to surah by surah.
- **Audio manager** to download any surah, or all 114, for offline listening.
- **Bookmarks with notes**, jump to any verse by typing `55:13`, and the app reopens where you left off.
- **Fifteen themes** (ten dark, five light), interface size from 50% to 200%, full screen, and a player bar that can hide until you need it. A short first-run setup (skippable) sets theme, size, language and reading mode. Settings has a search bar, a Reset on each setting and a list of what you changed. Small tips offer a setting when you keep doing what it is for (and can be switched off).
- **Runs in the system tray** with optional reminders and the Verse of the Day.

The complete list, with the keyboard shortcuts, is in **[docs/FEATURES.md](docs/FEATURES.md)**.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="assets/screenshots/reading-spread.webp" alt="Two-page Madani Mushaf spread in the White and Gold theme"/><br/><sub><b>Reading</b> a two-page Madani Mushaf spread (White &amp; Gold)</sub></td>
    <td width="50%"><img src="assets/screenshots/theme-night.webp" alt="Verse by Verse in the dark Night theme"/><br/><sub><b>Night</b> theme, Verse by Verse with the translation</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="assets/screenshots/audio-manager.webp" alt="Audio manager: choose a reciter, download or delete surahs"/><br/><sub><b>Audio manager:</b> choose a reciter, then download or delete surahs</sub></td>
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

There are no accounts, no analytics and no tracking. The app talks to the [Quran.com](https://quran.com) API and its audio hosts only to fetch audio, translations other than the bundled one, the reciter list, and the Verse of the Day. Bookmarks, settings and downloads stay on your computer.

## Build from source

You need [Node.js 22+](https://nodejs.org) and Rust (see the [Tauri prerequisites](https://tauri.app/start/prerequisites/)).

```bash
git clone https://github.com/Obscyra/quran-desktop.git
cd quran-desktop/app
npm install
npm run bundle        # once: downloads the Quran text and page fonts (about 120 MB) that ship with the app

npm run tauri dev     # the desktop app, with hot reload
npm run dev           # the interface alone, in a browser at http://localhost:1420
npm run check         # type check
npm run tauri build   # an installer for your system
```

**Tech stack:** [Tauri 2](https://tauri.app) (Rust) with [SvelteKit](https://svelte.dev/docs/kit), Svelte 5 and TypeScript. Text, word timings and audio come from the Quran.com API; downloads are kept in IndexedDB.

## Contributing

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Want a feature? [Request it here](https://github.com/Obscyra/quran-desktop/issues/new?template=feature.yml). Found a security problem? See [SECURITY.md](SECURITY.md). Release notes are on the [Releases page](https://github.com/Obscyra/quran-desktop/releases).

## Credits

- **Data and audio:** the [Quran.com](https://quran.com) / [Quran.Foundation](https://quran.foundation) public API, and the audio hosts it points to such as [quranicaudio.com](https://quranicaudio.com).
- **Mushaf fonts, tajweed markup and IndoPak text:** Quran.com and the King Fahd Quran Printing Complex.
- **Other Arabic fonts** (SIL Open Font License, bundled): [Amiri Quran](https://github.com/aliftype/amiri-quran), [Scheherazade New](https://software.sil.org/scheherazade/) and [Noto Naskh Arabic](https://fonts.google.com/noto/specimen/Noto+Naskh+Arabic).
- **Inspiration:** this app was built by studying [Quran for Android](https://github.com/quran/quran_android), the open-source app by the Quran.com community. It is an independent project written from scratch in TypeScript and Rust. Looking for the Android app? It is on [Google Play](https://play.google.com/store/apps/details?id=com.quran.labs.androidquran) and [IzzyOnDroid](https://apt.izzysoft.de/packages/com.quran.labs.androidquran).
- **Open-source projects used:** [Tauri](https://tauri.app), [Svelte](https://svelte.dev) and [SvelteKit](https://svelte.dev/docs/kit), [Vite](https://vite.dev).

May Allah reward everyone who has helped make the Quran freely available.

## License

The source code is licensed under the [GPL-3.0](LICENSE): modifications must be open-sourced too.

The Quran text, fonts and audio are not covered by that licence. They come from Quran.com and other sources under their own terms, often non-commercial ones, so check each before redistributing them. This project exists to serve the ummah, and the maintainer asks that forks stay free of ads and in-app purchases.
