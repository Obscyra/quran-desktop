# Contributing

Thank you for helping. Bug reports are as valuable as code.

## Reporting problems

- **Arabic text looks wrong?** Use the [Arabic text report](https://github.com/Obscyra/quran-desktop/issues/new?template=arabic-text.yml). Give the surah and verse (for example `2:255`), the script style and a screenshot. This is the most important kind of report.
- **Anything else:** use the [bug report](https://github.com/Obscyra/quran-desktop/issues/new?template=bug.yml).

## Code changes

For anything beyond a small fix, please open an issue first so we can agree on the approach.

```bash
git clone https://github.com/Obscyra/quran-desktop.git
cd quran-desktop/app
npm install
npm run bundle      # once: the Quran text and page fonts that ship with the app
npm run dev         # the interface in a browser at http://localhost:1420
npm run check       # must report 0 errors and 0 warnings before you open a pull request
```

Use `npm run tauri dev` for the real desktop window. The stack is Tauri 2, SvelteKit, Svelte 5 (runes) and TypeScript.

Please keep to these rules, which come from how the app is meant to be:

- **No ads, no tracking, no paid features.**
- **No mistakes in the Arabic.** Use the per-page glyph fonts for the Mushaf script and never retype Quranic text by hand.
- **Reading comes first;** listening stays optional.
- Say what you tested. A browser check is not the same as the Windows or macOS window.

## Releases

Maintainers: see [docs/RELEASING.md](docs/RELEASING.md).
