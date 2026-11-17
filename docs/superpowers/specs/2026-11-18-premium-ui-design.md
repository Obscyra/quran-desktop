# Premium UI redesign

Date: 2026-11-18. Status: approved by the owner (mock-ups reviewed, amended).

## 1. Intent

The owner finds the current UI generic and wants it to look as premium as
possible. The chosen direction is a blend: the app chrome (title bar, sidebar,
player, settings) is quiet and modern, and the craft and ornament live on the
Mushaf page, like a printed Mushaf.

What reads as generic today:

- Flat surfaces: `--bg-2` panels are separated only by a tone shift.
- About 11 different radii and an ad-hoc type scale from 11 to 15px.
- Pure black shadows.
- Hand-drawn icons at mixed sizes.
- Browser-default range inputs in Settings.
- A weak surah banner: an accent-tint rounded box in `PageSheet.svelte`, and a
  CSS double border for the "Frame" page look.
- Settings has 9 areas with overlapping and dead options.

## 2. Goals, non-goals, anti-goals

Goals:

- One consistent design system (radii, type, spacing, elevation, controls,
  icons) applied across all chrome.
- A calligraphic surah frame on the first page of each surah, recoloured by
  every one of the 15 themes.
- Settings regrouped from 9 areas to 7, with duplicate and dead options
  removed or merged, and no user losing a stored choice.
- More air: larger rows and gaps in the sidebar and Settings.

Non-goals:

- Changing how Quran text is rendered or any page geometry (sheet padding,
  0.66 aspect ratio, banner row heights, word `em` padding, QCF and KFGQPC
  fonts, `text-rendering: geometricPrecision`).
- Changing Arabic or Quran text sizes. They are outside the chrome type scale.
- New features, new settings, or paid tiers.

Anti-goals:

- Decorative noise in the chrome. Ornament belongs on the Mushaf page only.
- Violet or any hue not derived from the theme roles.
- Oversized type: nothing in the chrome is larger than 18px.
- A serif display font in the chrome.

## 3. Approaches considered

1. Chrome-only polish. Safe and cheap, but the Mushaf page, where the owner
   spends their time, stays plain. Rejected: it does not answer "premium".
2. Ornament everywhere. Frames, patterns and grain across the whole UI.
   Rejected: it competes with the text, adds noise, and is hard to keep
   readable in 15 themes.
3. Blend (chosen). Quiet, tightly specified chrome plus a single strong
   ornament, the surah frame, on the page. It keeps reading first, matches the
   project rule that the player and chrome stay out of the way, and limits the
   risk to one component (`PageSheet`) plus the verse-mode header.

## 4. Design system

Every new token derives from the six theme roles set by `applyTheme()` in
`app/src/lib/themes.ts` (`--bg --surface --ink --muted --accent --accent-ink`)
using `color-mix(in oklab, ...)`. It must read well in all 15 themes, light and
dark.

Radii (nothing else in chrome CSS):

- `--r-sm` 6px: chips, small buttons.
- `--r-md` 10px: buttons, inputs, list rows.
- `--r-lg` 16px: cards, menus, popovers, dialogs.
- `--r-pill` 999px.

Type:

- UI font: Manrope, variable, weights 200 to 800, bundled locally under
  `app/static/fonts/manrope/` (OFL). Stack: `'Manrope', 'Inter', system-ui,
  sans-serif`. Inter remains only as a fallback.
- Scale in px: 11 caps label (letter-spacing .08em, weight 600), 12.5 meta,
  13.5 body and rows, 15 subhead, 18 title.
- Nothing in the chrome is larger than 18px. Titles are weight 600 with
  letter-spacing -0.01em.
- No serif display font. Newsreader, used in the mock-ups, is dropped.
- Arabic and Quran text sizes are not part of this scale.

Spacing:

- Sidebar surah rows 48px tall with a 2px gap.
- Settings section nav items 40px tall with a 4px gap.
- Settings rows min-height 56px with 12px vertical padding.
- 28px between Settings groups.

Elevation: three tinted levels `--e1`, `--e2`, `--e3` as in the reference
stylesheet, built from `color-mix` of the theme roles. No raw `#000b`-style
shadows.

- e1: 1px inset top highlight plus a soft drop (controls, thumbs).
- e2: menus and popovers.
- e3: dialogs.

Surfaces:

- Title bar and sidebar form one continuous surface with a hairline divider
  (ink at about 7%).
- The reader canvas gets a faint accent radial glow (about 4%).
- Paper sheets get a layered shadow and a very subtle grain (about 3%).

Controls:

- One segmented-control style.
- Custom range slider: 4px track, accent fill, 16px thumb with e1.
- Toggle: 36x20.
- One primary, secondary and danger button set.

Icons: Lucide paths (ISC licence, credited), 20px grid, stroke-width 1.6,
`stroke="currentColor"`, inline SVG.

Layout rules that stay: layout changes are one reflow plus a transform glide,
never animated width or height. The Windows title bar stays a drag region with
46px window control buttons.

## 5. Surah frames

Three frame styles, chosen automatically per theme (no new setting):

- Madinah: night, forest, gold, paper.
- Ottoman: tide, fjord, slate, stone, rosewater, rosewood.
- IndoPak: moss, sidr, sage, graphite, tahajjud.

The IndoPak script always uses the IndoPak frame, whatever the theme. The
frame-for-theme map lives in `themes.ts`.

Rendering technique:

- Each frame is a single-colour SVG used as a CSS mask over
  `background: var(--accent)`, so it recolours with every theme.
- Madinah uses a 3-slice `-webkit-mask-box-image` / `mask-border` with slice
  2600 SVG units (source viewBox 8240 x 1016, about 8.1:1).
- Ottoman uses slice 310 (viewBox 1050 x 100, 10.5:1).
- IndoPak uses slice 262 (viewBox 1050 x 100, 10.5:1).
- The frame must fit inside the existing banner row. Banner height is derived
  in CSS, not measured in JS (the mock-up measured it in JS as a shortcut). The
  Madinah glyph is not stretched, since that distorts its roundels.
- The surah name inside is calligraphic, from `surah-names.woff2`: set the
  text to `surahNNN` (zero-padded to 3 digits, for example `surah002`) in that
  font family. The glyph is the name only, without the word "Surah".
- Applies to the paged and scroll banner in `PageSheet.svelte`, and the
  verse-mode header in `Reader.svelte`. The `look-frame` page border is
  upgraded to match. If page geometry changes anyway, rerun
  `app/scripts/learn-fit.mjs` and commit the updated `fit-data.json`.

Assets ship to `app/static/ornaments/` (frames and name font).

Licence and credits:

- Madinah frame: the glyph `surah_header` from the QUL common font (Tarteel
  QUL resource 459). The surah-name font is QUL resource 457. Neither states a
  licence. This is the same status as the QCF and KFGQPC fonts the app already
  ships. The owner must confirm redistribution terms with Tarteel before any
  public release. Until then both are credited in About.
- Ottoman and IndoPak frames are original work, generated for this project and
  licensed GPL-3.0 with the app. The Ottoman frame is modelled loosely on the
  structure of a public-domain manuscript heading (Met Open Access, object
  453024); no pixels or traced paths from it are in the file. Provenance is
  kept in the workspace `SOURCES.md`.
- Known quality notes: Madinah is the strongest. Ottoman is clean but sparser
  than a real manuscript heading, with slightly lumpy rumi horns at 3x zoom.
  IndoPak is crisp but mechanical, and its fine lattice disappears under about
  400px wide.

## 6. Settings

Nine areas become seven.

1. Appearance: theme, interface size (presets plus the custom % input, which
   stays), Arabic surah names.
2. Mushaf and script: the merged Mushaf choice, text size, line spacing, page
   look, flow, spread, continuous book, page info, highlight bookmarks.
3. Translation and tafsir: translation, tafsir edition, word meanings,
   transliteration, one text-size slider, "Open in", resume.
4. Listening: reciter, speed, play the next surah, repeat, say a word, follow
   mode, player bar mode.
5. Offline: the manager, with one link in.
6. Reminders.
7. App: full screen, keep awake, tips, tray, startup, updates, keyboard
   shortcuts, bookmarks export and import, reset, about with credits.

Removals:

- All dead focus-mode code: `FOCUS_MODE`, `ui.focus` paths, the Focus rows and
  button, the Z shortcut line, and the `autoHideChrome` setting.
- The reminder buttons "Preview today's verse" and "Send a test".
- The highlight style choice. Sweep is kept as the only style.

Merges (each migrates stored `quran.settings.v2` values so no user loses a
choice; exact keys and mappings are settled in the Settings task):

- Script and page type become one Mushaf choice with three values: Madani
  pages, IndoPak pages, text fonts. The old pair maps to the matching value.
- Follow and lock become one setting with three values: `off`, `follow`,
  `lock`. The reader sub bar's lock icon cycles the same setting.
- Player bar mode: `listenBar` and `playerHover` become one setting with
  `demand`, `always`, `autohide`. A user who had hover on keeps `autohide`;
  one who had the bar always open gets `always`; otherwise `demand`.
- Translation and tafsir text size become one slider; `translationSize` drives
  both. The larger of the two old values is kept.

Kept as they are: the reader sub bar and player quick controls (shortcuts to
the same settings) and the custom % interface size. Search must find every
row, so the search `ROWS` map is fixed, including orphan labels.

## 7. Known mock-up defects the build must not reproduce

- The title bar page number must match the page actually shown.
- IndoPak screens must actually use the IndoPak script, not the Madani one.
- Surah names must not get spaced hyphens: "Al-Fatihah", never "Al - Fatihah".

Also not carried over from the mock-ups: the mode switch moved into the sub
bar capsule and removal of the title bar brand were mock deviations to be
re-decided in the Chrome task; the compact (900px) layout needs a real CSS
container query, not JS.

## 8. Verification

- `cd app && npm run check` reports 0 errors and 0 warnings after every task.
- Playwright in the browser at `http://localhost:1420/#/1?os=windows` and
  `/#/2`:
  - Screenshot paged, scroll and verse modes across five or more themes (one
    per frame style plus a light and a dark), and compare with the approved
    mock-ups.
  - Confirm the frame recolours and fits the banner rows without overflow.
  - Check that the Arabic is correct.
  - Check that `fit()` results are unchanged, or that `learn-fit` was rerun.
- Settings: every area renders and search finds every row. Seed
  `localStorage` with the old `quran.settings.v2` keys, reload, and check the
  migration maps them correctly. The merged controls drive the same behaviour.
- A browser test is not the real Tauri window. This is stated in every report;
  `win-build.sh` and `win-test.mjs` are offered only when asked.
- Dev server is stopped with `fuser -k 1420/tcp`.
- Commits go straight to `main` as Obscyra with the Sonnet trailer. There is
  no push or tag until the owner tests. The owner's uncommitted `.gitignore`,
  `CLAUDE.md` and `package-lock.json` stay out of every commit.
