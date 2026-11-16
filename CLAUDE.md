# Quran for Desktop

Free, open-source (GPL-3.0), ad-free Quran app for Windows, macOS and Linux. Tauri 2 + SvelteKit 3 (adapter-static, SPA) + Svelte 5 runes + TypeScript. App code in `app/`. Repo: https://github.com/Obscyra/quran-desktop. Inspired by quran_android (credit it; keep its links in the README). Data: Quran.com API v4.

## How to work (Karpathy rules)

Invoke the `karpathy-guidelines` skill before executing any task.

1. **Think before coding.** State assumptions. If a request has several readings or something is unclear, ask; don't pick silently. Push back when a simpler way exists.
2. **Simplicity first.** Minimum code that solves the request. No extra features, single-use abstractions, speculative options or error handling for impossible cases.
3. **Surgical changes.** Touch only what the request needs; match existing style. Don't refactor or "improve" neighbouring code. Remove only the orphans your own change created; mention other dead code instead of deleting it. Every changed line must trace to the request.
4. **Goal-driven.** Turn the task into a checkable goal and loop until it is verified (`npm run check` = 0 errors, 0 warnings; a browser test for behaviour). Say plainly what was and wasn't verified.

## Owner's rules (do not break)

- Don't build the Windows installer unless asked. After a local build, copy it to `/mnt/d/Downloads/Quran-Beta/` without asking (`cp`, check the target first).
- Don't tag releases, push, or make the repo public without the owner's go-ahead. Betas are `x.y.z-beta.n` until the owner has tested.
- Focus mode stays off (`FOCUS_MODE = false` in `ui.svelte.ts`).
- Everything free: no ads, no paid features.
- No mistakes in Arabic. Use the per-page glyph fonts for the Mushaf script.
- Reading first; listening is optional (the player bar opens on demand).
- Be honest about verification: a browser test is not the real Tauri window.
- Commits: author `Obscyra <170297987+Obscyra@users.noreply.github.com>` (repo git config, never another email). Allowed trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Never `pkill -f "vite dev"` (kills the shell); stop the dev server with `fuser -k 1420/tcp`.

## Run and test

- Dev: `cd app && npm install && npx vite dev --port 1420`, open `http://localhost:1420/#/55?os=windows` (`?os=` previews other window chrome).
- `npm run check` must be 0 errors, 0 warnings. `npm run bundle` once downloads the offline data (gitignored, ~120 MB; CI does it); without it the app uses the network.
- Browser tests: Playwright scripts in the session scratchpad. Check line overflow, glyph fonts, word menu, playback, offline.
- Real Windows window: `app/scripts/win-test.mjs` (the owner's installed app must be closed; single instance).
- SvelteKit 3: config lives in `vite.config.js` (no `svelte.config.js`); `$lib` is kept through `alias`.

## Architecture (`app/src/lib`)

- `api.ts` (Quran.com), `fonts.svelte.ts` (page fonts `QCF{n}`, cached in IndexedDB via `offline.ts`), `pages.ts` (groups words into Mushaf pages/lines), `player.svelte.ts` (audio engine, per surah), `reader.svelte.ts` (page state, spread, continuous book), `settings.svelte.ts` (localStorage `quran.settings.v2`), `actions.ts`, `themes.ts`, `hints.svelte.ts`, `tafsir.svelte.ts`, `datasync.svelte.ts`, `updater.svelte.ts`.
- Components: `Reader` (modes), `PageSheet` (one Mushaf page; `fit()` sizes text to the widest line), `Word`, `End`, `WordMenu`, `Sidebar`, `PlayerBar`, `Settings`, `Welcome`, `TitleBar`.
- Continuous book (`settings.continuous`, default on): `reader.pages` is `groupBook` over a window of consecutive surahs (`reader.range`, text in `reader.cache`, current surah via `reader.keep`), merged by page number so a page where two surahs meet shows both (banners per `page.starts`). Word keys are `chapter-verse-pos`; DOM ids `w-<ch>-<v>-<pos>` and `end-<ch>-<v>`; `Word` and `End` need `ch`. The window grows both ways (`reader.extend`; scroll mode fixes `scrollTop` by hand, `overflow-anchor: none`). The reader moves the player itself (`reader.selfNav`), never while playing, and in paged mode only after a real page turn (`reader.turns`). Spread: odd page right, even left when on. Sidebar highlights `reader.visible` surahs, the playing one strongest. Browser-tested only, not yet seen in the real window.
- Gotchas: `text-rendering: geometricPrecision` on glyph text; word padding in `em`; `$state.snapshot()` before storing proxies in IndexedDB; tajweed class names contain hyphens; `fonts.has()` must read `tick`.
- Layout changes = one reflow plus a transform glide, never animated width/height. Rerun `scripts/learn-fit.mjs` if page fonts, layout or word-spacing CSS change (updates `src/lib/fit-data.json`).

## Desktop shell (`app/src-tauri`)

- Window state, tray, autostart and single-instance plugins (single-instance must be first). Closing hides to tray when `settings.background` is on (done in JS, `+page.svelte`).
- Windows draws its own title bar; macOS and Linux use the native one. Media controls: taskbar buttons on Windows, `souvlaki` (MPRIS / Now Playing) elsewhere.
- Keep npm and crate versions of Tauri plugins in step; `Cargo.lock` is committed.

## Build and release (only when asked)

- Windows build runs from WSL in `C:\Users\magnum\quran-build` (copy of `app/`): rsync, write `tauri.local.json`, run `npm.cmd run tauri build` through `powershell.exe` with `CARGO_PROFILE_RELEASE_LTO=false` and `CODEGEN_UNITS=16` (keep identical every build). Installer: `src-tauri\target\release\bundle\nsis\Quran_<version>_x64-setup.exe`.
- CI: pushing a `v*` tag runs `.github/workflows/release.yml` (Windows, macOS, Linux; signs updates, publishes `latest.json`; notes from `.github/release-notes/<tag>.md`). Start releases with `gh workflow run release.yml --ref main -f tag=vX.Y.Z`.
- Update signing key `~/.tauri/quran-desktop.key`; losing it breaks updates for installs.
- Version lives in `app/package.json`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml`. Current: 0.0.10-beta.
- Not verified: in-app update path, SmartScreen (no code-signing cert), CSP in a real Tauri window.

## Website

Separate repo https://github.com/Obscyra/quran-desktop-site, kept in `website/` (excluded from this repo; commit from inside it). Netlify: https://qurandesktop.netlify.app.
