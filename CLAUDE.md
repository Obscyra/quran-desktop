# Quran for Desktop — project memory

Free, open-source (GPL-3.0), ad-free desktop Quran app for Windows and macOS (Linux later).
Tauri 2 + SvelteKit (adapter-static, ssr=false) + Svelte 5 runes + TypeScript. Repo:
https://github.com/Obscyra/quran-desktop (branch `main`, currently private). Inspired by
https://github.com/quran/quran_android (credit it and keep its Android links in the README; the app now has its own icon).
Data from the Quran.com public API v4. App code is in `app/`; `reference/` (gitignored) holds a clone
of quran_android.

## Owner's rules (do not break)
- Focus mode is switched off until the owner says so (`FOCUS_MODE = false` in `ui.svelte.ts` hides its button, shortcut and settings).
- Don't build unless asked; the owner has said "don't build" more than once.
- Never build until told ("don't build until I say so"). Building = Windows .exe, see below.
- Everything is free: no ads, no paid features. Beta versions (`x.y.z-beta.n`) until the owner has tested.
- No mistakes in the Arabic writing. Use the per-page glyph fonts for the Mushaf script.
- Reading first; listening is optional (player bar opens on demand).
- Be honest about what was verified. Browser tests are not the real Windows window.
- Don't tag releases or make the repo public without the owner's go-ahead.
- Commits: author is the owner's GitHub account (repo git config: `Obscyra <170297987+Obscyra@users.noreply.github.com>`; never use another email, it links to the wrong GitHub user). Claude may be credited with a trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (owner allowed it).

## Architecture (app/src/lib)
- `api.ts` quran.com calls: `fetchVerses` (words with `code_v2` glyph, `v2_page`, tajweed markup,
  audio_url), `fetchIndo` (IndoPak text + 15-line layout via `mushaf=3`), `fetchChapterAudio`
  (per-word segments), reciters, translations.
- `fonts.svelte.ts` loads quran.com page fonts `verses.quran.foundation/fonts/quran/hafs/v2/woff2/p{n}.woff2`
  as `QCF{n}`, cached in IndexedDB (`offline.ts`, DB v3: text, audio, blobs, fonts, indo).
  `has()` must read `tick` to stay reactive.
- `player.svelte.ts` audio engine: lazy audio load (`prepareAudio`), `playVerse` (range + loop),
  `playFrom`, `playWord` (wbw mp3, or segment offline), `goTo`/`jump` for bookmarks and search.
- `reader.svelte.ts` page state incl. two-page spread (even page right, the next odd page left: 2 faces 3). `pages.ts` groups
  words by page/line (normalises by reading order; the API mislabels some verses).
- `settings.svelte.ts` (localStorage `quran.settings.v2`), `bookmarks.svelte.ts`, `ui.svelte.ts`,
  `actions.ts`, `translations.svelte.ts`, `updater.svelte.ts`, `themes.ts`, `platform.ts`.
- Components: `TitleBar` (custom chrome; Verse by Verse | Reading switch; listen/focus/fullscreen/menu),
  `Reader` (sub-bar + modes), `PageSheet` (one Mushaf page; `fit()` sizes text to the widest line),
  `Word`, `End` (verse-end marker), `WordMenu`, `Sidebar` (Surahs | Bookmarks, type `55:13`),
  `PlayerBar`, `Settings`.
- Gotchas: `text-rendering: geometricPrecision` on glyph text (hinting draws stray strokes otherwise);
  word padding in `em` so line fitting scales linearly; `$state.snapshot()` before storing proxies in
  IndexedDB; never `pkill -f "vite dev"` (kills the shell) — use `fuser -k 1420/tcp`.
- Reciters: `reciters.ts` is quran.com's list with portrait paths (`static.qurancdn.com/<photo>`); recordings
  without word timings (`approx`) get word timings estimated from verse spans in `player.fetchAudio`.
- Reminders / verse of the day: `notifications.svelte.ts` + `NoticeCard.svelte`; system toasts use
  `tauri-plugin-notification` (Cargo + capability added, not yet compiled on Windows).
- Left-click a word plays it; right-click opens `WordMenu`. Back/forward trail lives in `player.svelte.ts`.
- Fonts bundled in `app/static/fonts`: KFGQPC Uthmanic Hafs, IndoPak Nastaleeq (from quran.com).

## Run and test
- UI in a browser: `cd app && npm install && npx vite dev --port 1420` then
  `http://localhost:1420/#/55?os=windows` (`?os=` previews other chrome).
- Type check: `npm run check` (must be 0 errors, 0 warnings).
- Playwright scripts used for tests live in the session scratchpad (`pw/`); write new ones with the
  `playwright` npm package. Check line overflow/overlap, glyph fonts, word menu, verse-only playback,
  and offline (download, then abort non-localhost requests and reload).

## Build the Windows installer (only when asked)
WSL2 with Windows interop. Build happens in `C:\Users\magnum\quran-build` (copy of `app/`):
1. `rsync -a --delete --exclude node_modules --exclude .svelte-kit --exclude build --exclude target app/ /mnt/c/Users/magnum/quran-build/`
2. `echo '{"bundle":{"createUpdaterArtifacts":false}}' > /mnt/c/Users/magnum/quran-build/src-tauri/tauri.local.json`
3. `powershell.exe -NoProfile -Command 'cd C:\Users\magnum\quran-build; $env:Path += ";C:\Program Files\nodejs;$env:USERPROFILE\.cargo\bin"; npm.cmd run tauri build -- --config src-tauri\tauri.local.json'`
   (run in background, ~5+ min; PowerShell reports exit 1 from stderr even on success).
4. Installer: `quran-build\src-tauri\target\release\bundle\nsis\Quran_<version>_x64-setup.exe`.
   Copy to `D:\Downloads\Quran-Beta\` (`/mnt/d/Downloads/Quran-Beta/`) with a README.txt.
Don't install on the owner's PC unless asked. Don't use `-ExecutionPolicy Bypass`.

## Releases and updates
- `.github/workflows/release.yml`: pushing a `v*` tag builds Windows (.exe) + macOS (.dmg), signs update
  artifacts, publishes `latest.json`. Tags with a suffix (`-beta.1`) become pre-releases.
- Needs secrets `TAURI_SIGNING_PRIVATE_KEY` (+ `_PASSWORD`, empty). Key is `~/.tauri/quran-desktop.key`;
  the public key is in `app/src-tauri/tauri.conf.json`. Losing the key breaks updates for installs.
- Installed apps only see updates from a public repo's non-prerelease `latest`.
- Uninstaller (`src-tauri/windows/hooks.nsi`) removes app data unless `$UpdateMode`; verified earlier.
- Version lives in `app/package.json`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml`
  (CI overrides from the tag).

## Status
- Shipped: v0.3.0-beta.1 installer in `D:\Downloads\Quran-Beta\`, pushed as commit `bd2b0bd`
  (exact Mushaf pages, Verse by Verse / Reading modes, 2-page spread, 7 script styles, Madani/IndoPak
  page types, word/verse menu, bookmarks, optional listening bar).
- Not yet verified: the real Windows window (title-bar buttons, drag, snap, fullscreen, focus mode),
  updater end to end, macOS build, SmartScreen (no code-signing cert).
- Ideas not done: tafsir, sleep timer, download-all manager, in-text search, true OS Do Not Disturb
  (no public API; only in-app quiet focus mode), 21st MCP, Linux.
