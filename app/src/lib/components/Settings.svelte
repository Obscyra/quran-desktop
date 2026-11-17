<script lang="ts">
  import ReciterPicker from './ReciterPicker.svelte';
  import TranslationPicker from './TranslationPicker.svelte';
  import TafsirPicker from './TafsirPicker.svelte';
  import { onMount, tick } from 'svelte';
  import { bookmarks } from '$lib/bookmarks.svelte';
  import { pageFonts } from '$lib/fonts.svelte';
  import { sample } from '$lib/script-sample';
  import * as offline from '$lib/offline';
  import { player } from '$lib/player.svelte';
  import { reader } from '$lib/reader.svelte';
  import { getAutostart, isTauri, setAutostart } from '$lib/platform';
  import { hints } from '$lib/hints.svelte';
  import { SCRIPTS, settings, type SettingsShape, type PageLook, type Script, type WordMeaning } from '$lib/settings.svelte';
  import { THEMES } from '$lib/themes';
  import { translations } from '$lib/translations.svelte';
  import { autocache, KEEP_DAYS } from '$lib/autocache.svelte';
  import { confirm } from '$lib/confirm.svelte';
  import { ui, type SettingsArea } from '$lib/ui.svelte';
  import { parseNotes } from '$lib/notes';
  import { updater } from '$lib/updater.svelte';
  import { tafsirs } from '$lib/tafsir.svelte';

  const AREAS: { id: SettingsArea; name: string; hint: string }[] = [
    { id: 'appearance', name: 'Appearance', hint: 'Theme, interface size, surah names' },
    { id: 'mushaf', name: 'Mushaf & script', hint: 'Script, page layout, text size' },
    { id: 'translation', name: 'Translation & tafsir', hint: 'Translation, tafsir, word meanings' },
    { id: 'listening', name: 'Listening', hint: 'Reciter, follow along, player' },
    { id: 'offline', name: 'Offline', hint: 'Downloads for offline use' },
    { id: 'reminders', name: 'Reminders', hint: 'Verse of the day, reading reminders' },
    { id: 'app', name: 'App', hint: 'Window, updates, data, about' }
  ];
  // Lucide (ISC) icon bodies, 24 grid
  const ICONS: Record<SettingsArea, string> = {
    appearance: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    mushaf: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    translation: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
    listening: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
    offline: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    reminders: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    app: '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>'
  };
  const onPage = (s: SettingsArea) => ui.area === s;

  // ───── search ─────
  // every setting, with the words people may look for it by (the area it lives in is added when searching)
  const ROWS: { area: SettingsArea; title: string; text: string }[] = [
    { area: 'appearance', title: 'Theme', text: 'colour color dark light night black madinah slate paper stone gold white auto system' },
    { area: 'appearance', title: 'Interface size', text: 'zoom scale bigger smaller menus buttons' },
    { area: 'appearance', title: 'Surah names in Arabic', text: 'arabic names list player' },
    { area: 'mushaf', title: 'Page layout', text: 'madani indopak 15 lines print 604 610 pages text fonts' },
    { area: 'mushaf', title: 'Mushaf', text: 'font madani indopak pages 15 lines print 604 610 text fonts tajweed uthmani naskh amiri scheherazade arabic writing script' },
    { area: 'mushaf', title: 'Font', text: 'text fonts script card sample' },
    { area: 'mushaf', title: 'Text size', text: 'font arabic bigger larger' },
    { area: 'mushaf', title: 'Line spacing', text: 'height lines gap' },
    { area: 'translation', title: 'Continue where I left off', text: 'resume reopen last place surah verse start remember position' },
    { area: 'translation', title: 'Open in', text: 'start view verse by verse reading mode default' },
    { area: 'translation', title: 'Tafsir edition', text: 'tafsir tafseer commentary language edition follow translation' },
    { area: 'translation', title: 'Translation', text: 'language english urdu meaning verse' },
    { area: 'translation', title: 'Translation and tafsir text size', text: 'font bigger tafsir commentary' },
    { area: 'translation', title: 'Word meanings', text: 'word by word hover below under each word language' },
    { area: 'translation', title: 'Transliteration', text: 'pronounce latin letters' },
    { area: 'mushaf', title: 'Page look', text: 'paper frame plain border background' },
    { area: 'mushaf', title: 'Page flow', text: 'scroll turn one page long sheet' },
    { area: 'mushaf', title: 'Two-page spread', text: 'facing book open wide T' },
    { area: 'mushaf', title: 'Continuous book', text: 'continuous across surahs next surah run on book join' },
    { area: 'mushaf', title: 'Page info', text: 'surah name juz page number header footer' },
    { area: 'mushaf', title: 'Highlight bookmarks', text: 'ornament marker verse end' },
    { area: 'listening', title: 'Player bar', text: 'listening player always on demand dock auto-hide hover bottom edge' },
    { area: 'listening', title: 'Reciter', text: 'qari sheikh voice recitation' },
    { area: 'listening', title: 'Playback speed', text: 'faster slower rate' },
    { area: 'listening', title: 'Play the next surah', text: 'auto advance continue' },
    { area: 'listening', title: 'Repeat surah', text: 'loop memorise memorize' },
    { area: 'listening', title: 'Say a word when clicked', text: 'word audio click play' },
    { area: 'listening', title: 'Follow the recitation', text: 'auto scroll follow along lock verse scroll return centre center keep' },
    { area: 'offline', title: 'Reciter to manage', text: 'offline manager audio download delete recitation surah storage' },
    { area: 'offline', title: 'Tafsir edition', text: 'tafsir tafseer language edition download delete offline surah' },
    { area: 'listening', title: 'Saved offline content', text: 'storage downloads manager size' },
    { area: 'offline', title: 'Keep favourites offline', text: 'auto cache save automatically' },
    { area: 'reminders', title: 'Verse of the day', text: 'daily notification card' },
    { area: 'reminders', title: 'Reading reminders', text: 'notify nudge times alarm' },
    { area: 'reminders', title: 'Use system notifications', text: 'windows macos toast do not disturb' },
    { area: 'app', title: 'Full screen', text: 'fullscreen display F' },
    { area: 'app', title: 'Keep the screen on', text: 'awake sleep display wake lock' },
    { area: 'app', title: 'Show tips', text: 'hints suggestions popup cards help discover features' },
    { area: 'app', title: 'Keep running in the tray', text: 'background close system tray hide quit' },
    { area: 'app', title: 'Start with the computer', text: 'autostart startup boot login sign in' },
    { area: 'app', title: 'Keyboard', text: 'shortcuts keys hotkeys commands' },
    { area: 'app', title: 'Version', text: 'about release beta software' },
    { area: 'app', title: 'Update automatically', text: 'updates download new version' },
    { area: 'app', title: 'Offline downloads', text: 'storage space size audio' },
    { area: 'app', title: 'Bookmarks', text: 'export import backup notes' },
    { area: 'app', title: 'Reset settings', text: 'defaults restore' },
    { area: 'app', title: 'About', text: 'credits licence license open source version' },
    { area: 'app', title: 'Developer', text: 'author contact fahim shahriar github email website who made' }
  ];
  // the settings behind each row, so a row can say it was changed and go back to its default
  const ROW_KEYS: Record<string, (keyof SettingsShape)[]> = {
    'Theme': ['theme'], 'Interface size': ['uiScale'], 'Surah names in Arabic': ['arabicNames'],
    'Mushaf': ['script', 'pageType'], 'Page layout': ['pageType'], 'Text size': ['size'], 'Line spacing': ['spacing'],
    'Open in': ['mode'], 'Continue where I left off': ['resume'], 'Translation': ['translation'], 'Translation and tafsir text size': ['translationSize'], 'Word meanings': ['wordMeaning'], 'Transliteration': ['transliteration'],
    'Page look': ['pageLook'], 'Page flow': ['flow'], 'Two-page spread': ['spread'], 'Continuous book': ['continuous'], 'Page info': ['showPageInfo'], 'Highlight bookmarks': ['highlightBookmarks'],
    'Player bar': ['playerBar'], 'Playback speed': ['speed'], 'Play the next surah': ['autoAdvance'], 'Repeat surah': ['repeatSurah'],
    'Say a word when clicked': ['wordAudio'], 'Follow the recitation': ['follow'], 'Keep favourites offline': ['autoCache'],
    'Verse of the day': ['dailyVerse'], 'Show it from': ['dailyVerseTime'], 'Reading reminders': ['remindersOn'], 'Times': ['remindTimes'], 'Message': ['remindMessage'], 'Use system notifications': ['systemNotify'],
    'Keep the screen on': ['keepAwake'], 'Show tips': ['tips'], 'Keep running in the tray': ['background'], 'Update automatically': ['checkUpdates']
  };
  const changed = (title: string) => !!ROW_KEYS[title] && !settings.isDefault(ROW_KEYS[title]);
  function resetRow(title: string) {
    settings.resetKeys(ROW_KEYS[title]);
    if (title === 'Translation') player.refreshText();
  }
  const changedRows = $derived(ROWS.filter((r) => changed(r.title) && (isTauri() || r.title !== 'Keep running in the tray')));
  let showChanged = $state(false);
  let query = $state('');
  // the pages show only when neither the search nor the list of changed settings is on
  const browse = $derived(!query && !showChanged);
  let searchEl = $state<HTMLInputElement>();
  const areaName = (id: SettingsArea) => AREAS.find((a) => a.id === id)?.name ?? '';
  const found = $derived.by(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    // these only exist in the desktop app
    const desktopOnly = new Set(['Keep running in the tray', 'Start with the computer']);
    return ROWS.filter((r) => isTauri() || !desktopOnly.has(r.title)).map((r) => {
      const title = r.title.toLowerCase();
      const hay = `${title} ${r.text} ${areaName(r.area).toLowerCase()}`;
      if (!words.every((w) => hay.includes(w))) return null;
      return { r, rank: words.every((w) => title.includes(w)) ? 0 : 1 };
    })
      .filter((x) => x !== null)
      .sort((a, b) => a.rank - b.rank)
      .map((x) => x.r);
  });
  async function openResult(r: { area: SettingsArea; title: string }) {
    query = '';
    showChanged = false;
    ui.area = r.area;
    await tick();
    const row = [...document.querySelectorAll<HTMLElement>('.view .row')].find((el) => el.querySelector('.label h3')?.textContent?.trim() === r.title);
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 1800);
  }
  function searchKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && query) {
      e.stopPropagation();
      query = '';
    } else if (e.key === 'Enter' && found.length) openResult(found[0]);
  }
  const UI_SIZES = [0.9, 1, 1.1, 1.3, 1.5];

  // reminder times are kept as one "08:00,20:00" string in the settings
  const times = $derived(settings.remindTimes.split(',').map((t) => t.trim()).filter(Boolean));
  const saveTimes = (list: string[]) => (settings.remindTimes = [...new Set(list.filter((t) => /^\d{1,2}:\d{2}$/.test(t)))].sort().join(','));
  const setTime = (i: number, v: string) => saveTimes(times.map((t, j) => (j === i ? v : t)));
  const removeTime = (i: number) => saveTimes(times.filter((_, j) => j !== i));
  const addTime = () => saveTimes([...times, ['07:00', '12:30', '16:00', '19:00', '21:30', '05:00'].find((t) => !times.includes(t)) ?? '10:00']);

  async function resetSettings() {
    const ok = await confirm.ask({
      danger: true,
      steps: [{ title: 'Reset all settings?', body: 'Theme, script, text size, reading options, reminders and every other setting go back to how they were when the app was installed. Your bookmarks and downloads are kept.', ok: 'Reset settings' }]
    });
    if (ok) settings.reset();
  }

  // ───── download manager ─────
  let dlReciter = $state(player.reciterId);
  let sizes = $state(new Map<string, number>());
  let onlyDownloaded = $state(false);
  let tafsirOnlyDownloaded = $state(false);
  let tafsirDownloads = $state(new Map<string, number>());
  let tafsirUsedBytes = $state(0);
  let tafsirBusy = $state('');
  let tafsirBulk = $state({ running: false, done: 0, total: 0, failed: 0 });
  let tafsirMessage = $state('');
  let tafsirController: AbortController | null = null;
  const tafsirHave = $derived(player.chapters.filter((c) => tafsirDownloads.has(`${settings.tafsirEdition}:${c.id}`)));
  const tafsirListed = $derived(tafsirOnlyDownloaded ? tafsirHave : player.chapters);
  const settingsTranslationLanguage = $derived(translations.list.find((t) => t.id === settings.translation)?.language ?? 'English');
  const tafsirLanguageMismatch = $derived(!!tafsirs.get(settings.tafsirEdition) && tafsirs.get(settings.tafsirEdition)?.language_name.toLowerCase() !== settingsTranslationLanguage.toLowerCase());
  const dlName = $derived(player.reciters.find((r) => r.id === dlReciter)?.name ?? 'this reciter');
  const have = $derived(player.chapters.filter((c) => player.isDownloadedFor(dlReciter, c.id)));
  const haveBytes = $derived(have.reduce((n, c) => n + (sizes.get(`${dlReciter}:${c.id}`) ?? 0), 0));
  const listed = $derived(onlyDownloaded ? have : player.chapters);
  const working = $derived(player.dl.running && player.dl.reciter === dlReciter);

  $effect(() => {
    player.downloaded; // refresh sizes whenever a download lands or is removed
    offline.blobInfo().then((m) => {
      sizes = m;
      usedBytes = [...m.values()].reduce((a, b) => a + b, 0);
    });
  });

  async function refreshTafsirDownloads() {
    tafsirDownloads = await offline.listTafsir();
    tafsirUsedBytes = [...tafsirDownloads.values()].reduce((total, size) => total + size, 0);
  }
  async function downloadTafsir(chapter: number) {
    const edition = settings.tafsirEdition;
    if (!edition || tafsirBusy || tafsirBulk.running) return;
    tafsirController = new AbortController();
    const controller = tafsirController;
    tafsirBusy = `${edition}:${chapter}`;
    tafsirMessage = '';
    try {
      await tafsirs.download(edition, chapter, controller.signal);
      await refreshTafsirDownloads();
    } catch (e) {
      if (!controller.signal.aborted) tafsirMessage = e instanceof Error ? e.message : 'Could not download this tafsir.';
    } finally {
      if (tafsirController === controller) tafsirController = null;
      tafsirBusy = '';
    }
  }

  async function downloadAllTafsir() {
    const edition = settings.tafsirEdition;
    if (!edition || tafsirBusy || tafsirBulk.running) return;
    const pending = player.chapters.filter((chapter) => !tafsirDownloads.has(`${edition}:${chapter.id}`));
    if (!pending.length) return;
    tafsirController = new AbortController();
    const controller = tafsirController;
    tafsirBulk = { running: true, done: 0, total: pending.length, failed: 0 };
    for (const chapter of pending) {
      if (controller.signal.aborted) break;
      tafsirBusy = `${edition}:${chapter.id}`;
      try {
        await tafsirs.download(edition, chapter.id, controller.signal);
        await refreshTafsirDownloads();
      } catch (e) {
        if (controller.signal.aborted) { tafsirBusy = ''; break; }
        tafsirBulk = { ...tafsirBulk, failed: tafsirBulk.failed + 1 };
      }
      tafsirBusy = '';
      tafsirBulk = { ...tafsirBulk, done: tafsirBulk.done + 1 };
    }
    tafsirBusy = '';
    if (tafsirController === controller) tafsirController = null;
    tafsirBulk = { ...tafsirBulk, running: false };
  }

  async function deleteAllTafsir() {
    const edition = settings.tafsirEdition;
    if (!edition || tafsirBulk.running || tafsirBusy) return;
    const editionName = tafsirs.get(edition)?.name ?? 'this edition';
    const count = tafsirDownloads.size ? [...tafsirDownloads.keys()].filter((key) => key.startsWith(`${edition}:`)).length : 0;
    if (!count) return;
    const ok = await confirm.ask({
      steps: [{ title: `Delete all ${editionName}?`, body: `Removes all ${count} saved surahs for this edition from this device. You can download them again later.`, ok: 'Delete all tafsir' }]
    });
    if (!ok) return;
    for (const key of tafsirDownloads.keys()) {
      if (!key.startsWith(`${edition}:`)) continue;
      await tafsirs.remove(edition, Number(key.slice(edition.length + 1)));
    }
    await refreshTafsirDownloads();
  }
  async function deleteTafsir(chapter: number, name: string) {
    const edition = settings.tafsirEdition;
    const editionName = tafsirs.get(edition)?.name ?? 'this edition';
    const ok = await confirm.ask({
      danger: true,
      steps: [{ title: `Delete ${name} tafsir?`, body: `Removes ${editionName} for this surah from this device. You can download it again later.`, ok: 'Delete tafsir' }]
    });
    if (!ok) return;
    await tafsirs.remove(edition, chapter);
    await refreshTafsirDownloads();
  }

  const downloadAll = () => player.downloadMany(dlReciter, player.chapters.filter((c) => !player.isDownloadedFor(dlReciter, c.id)).map((c) => c.id));

  async function deleteOne(chapter: number, name: string) {
    const ok = await confirm.ask({
      danger: true,
      steps: [
        { title: `Delete ${name}?`, body: `Removes the saved recitation by ${dlName}. You can download it again later.`, ok: 'Continue' },
        { title: 'Are you sure?', body: `${name} by ${dlName} will be removed from this device and will need a connection to play again.`, ok: 'Delete recitation' }
      ]
    });
    if (ok) await player.removeAudio(dlReciter, chapter);
  }
  async function deleteAll() {
    const ok = await confirm.ask({
      danger: true,
      steps: [
        { title: `Delete all of ${dlName}'s downloads?`, body: `${have.length} surahs (${mb(haveBytes)} MB) will be removed. Other reciters are not touched.`, ok: 'Continue' },
        { title: 'This cannot be undone', body: `Every saved recitation by ${dlName} will be deleted from this device. Downloading them again takes time and data.`, ok: `Delete ${have.length} surahs` }
      ]
    });
    if (ok) await player.removeAllFor(dlReciter);
  }

  let version = $state('dev');
  let usedBytes = $state(0);
  let savedAt = $state(0);
  let savedVisible = $state(false);
  let importMsg = $state('');

  let autostart = $state(false);
  async function toggleAutostart(on: boolean) {
    autostart = on;
    autostart = await setAutostart(on);
  }

  onMount(async () => {
    translations.load();
    refreshTafsirDownloads();
    getAutostart().then((on) => (autostart = on));
    pageFonts.ensure([1]); // the script previews draw page 1 in its own font
    if (isTauri()) version = await (await import('@tauri-apps/api/app')).getVersion();
    usedBytes = await offline.blobSizes();
  });

  $effect(() => {
    if (!ui.settingsOpen || ui.area !== 'offline') return;
    const translation = settings.translation;
    const autoFollow = settings.tafsirAutoFollow;
    void (async () => {
      await Promise.all([translations.load(), tafsirs.load()]);
      const language = translations.list.find((t) => t.id === translation)?.language ?? 'English';
      const edition = autoFollow ? tafsirs.chooseDefault(language)?.slug ?? '' : settings.tafsirEdition;
      if (autoFollow && edition && settings.tafsirEdition !== edition) settings.tafsirEdition = edition;
      await refreshTafsirDownloads();
    })();
  });

  $effect(() => {
    const translation = settings.translation;
    const autoFollow = settings.tafsirAutoFollow;
    if (!autoFollow) return;
    const needsTafsir = player.verses.some((v) => settings.tafsirFor(player.chapter, v.n));
    if (!needsTafsir && !tafsirs.editions.length) return;
    void (async () => {
      await translations.load();
      if (needsTafsir) await tafsirs.load();
      if (!settings.tafsirAutoFollow || settings.translation !== translation) return;
      const language = translations.list.find((t) => t.id === translation)?.language ?? 'English';
      const edition = tafsirs.chooseDefault(language)?.slug ?? '';
      if (edition) settings.tafsirEdition = edition;
    })();
  });

  // quiet "Saved" stamp whenever a setting changes
  $effect(() => {
    settings.snapshot();
    savedAt = Date.now();
    savedVisible = true;
    const t = setTimeout(() => (savedVisible = false), 1400);
    return () => clearTimeout(t);
  });

  const LOOKS: { id: PageLook; name: string; hint: string }[] = [
    { id: 'paper', name: 'Paper', hint: 'A page on the desk.' },
    { id: 'frame', name: 'Frame', hint: 'Bordered like a printed page.' },
    { id: 'plain', name: 'Plain', hint: 'Just the text.' }
  ];
  const MEANINGS: { id: WordMeaning; name: string }[] = [
    { id: 'off', name: 'Off' },
    { id: 'hover', name: 'On hover' },
    { id: 'below', name: 'Under each word' }
  ];
  const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

  const mb = (b: number) => (b / 1048576).toFixed(b > 1e8 ? 0 : 1);

  function setTranslation(id: number) {
    settings.translation = id;
    player.refreshText();
  }
  function setTafsirEdition(slug: string) {
    settings.tafsirEdition = slug;
    settings.tafsirAutoFollow = false;
  }
  function followTranslationTafsir() {
    settings.tafsirAutoFollow = true;
    const language = translations.list.find((t) => t.id === settings.translation)?.language ?? 'English';
    const edition = tafsirs.chooseDefault(language)?.slug ?? '';
    if (edition) settings.tafsirEdition = edition;
  }
  // one Mushaf choice: the two printed Mushafs, or a plain text font (which keeps the page type it had)
  let lastFont = $state<Script>(settings.script !== 'mushaf' && settings.script !== 'indopak' ? settings.script : 'uthmani');
  const mushafChoice = $derived<'madani' | 'indopak' | 'text'>(settings.script === 'mushaf' ? 'madani' : settings.script === 'indopak' && settings.pageType === 'indopak' ? 'indopak' : 'text');
  function setMushaf(c: 'madani' | 'indopak' | 'text') {
    if (c === 'madani') { settings.script = 'mushaf'; settings.pageType = 'madani'; }
    else if (c === 'indopak') { settings.script = 'indopak'; settings.pageType = 'indopak'; }
    else settings.script = lastFont; // keeps the current pageType on purpose
  }
  function setFont(id: Script) {
    lastFont = id;
    settings.script = id;
  }

  function exportBookmarks() {
    const url = URL.createObjectURL(new Blob([bookmarks.export()], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'quran-bookmarks.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function importBookmarks(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const n = bookmarks.import(await file.text());
      importMsg = n ? `Added ${n} bookmark${n === 1 ? '' : 's'}.` : 'Nothing new to add.';
    } catch {
      importMsg = 'That file is not a bookmarks export.';
    }
    input.value = '';
  }
</script>

{#snippet preview()}
  <div class="preview hl-sweep" style:--ar-size="{Math.min(settings.size, 52)}px" style:--ar-lh={settings.spacing}>
    <p dir="rtl" class="sample" class:glyph={settings.script === 'mushaf'} style:font-family={settings.script === 'mushaf' ? 'QCF1' : settings.fontFamily}>
      {#if settings.script === 'tajweed'}{@html sample('tajweed')}{:else}{sample(settings.script)}{/if}
    </p>
    {#if settings.translation}<small>In the name of Allah, the Entirely Merciful, the Especially Merciful.</small>{/if}
  </div>
{/snippet}

{#snippet rst(title: string)}
  {#if changed(title)}<button class="reset" onclick={() => resetRow(title)} title="Back to the default">Reset</button>{/if}
{/snippet}

{#snippet toggle(on: boolean, set: (v: boolean) => void, label: string)}
  <button class="toggle" class:on role="switch" aria-checked={on} aria-label={label} onclick={() => set(!on)}><i></i></button>
{/snippet}

<section class="settings">
  <nav aria-label="Settings areas">
    <h1>Settings</h1>
    <label class="find">
      <svg aria-hidden="true" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
      <input bind:this={searchEl} bind:value={query} onkeydown={searchKey} type="search" placeholder="Search settings" aria-label="Search settings" autocomplete="off" spellcheck="false" />
    </label>
    <button class="chg" class:on={showChanged} aria-pressed={showChanged} onclick={() => { showChanged = !showChanged; query = ''; }}>
      <span>Changed from default</span><b>{changedRows.length}</b>
    </button>
    {#each AREAS as a (a.id)}
      <button class:on={ui.area === a.id && !showChanged} onclick={() => { ui.area = a.id; showChanged = false; }} aria-current={ui.area === a.id && !showChanged ? 'page' : undefined}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{@html ICONS[a.id]}</svg>{a.name}
      </button>
    {/each}
  </nav>

  <div class="view"><div class="col">
    <header>
      <button class="back" onclick={() => ui.closeSettings()} aria-label="Back to reading" title="Back (Esc)">
        <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>
      </button>
      <h2>{query ? 'Search results' : showChanged ? 'Changed settings' : AREAS.find((a) => a.id === ui.area)?.name}</h2>
      <span class="saved" class:show={savedVisible} data-t={savedAt}>Saved</span>
      <button class="close" onclick={() => ui.closeSettings()} aria-label="Close settings">Done</button>
    </header>
    {#if browse}<p class="lede">{AREAS.find((a) => a.id === ui.area)?.hint}</p>{/if}

    {#if query}
      <ul class="results" aria-label="Search results">
        {#each found as r (r.area + r.title)}
          <li><button onclick={() => openResult(r)}><b>{r.title}</b><small>{areaName(r.area)}</small></button></li>
        {:else}
          <li class="none">No setting matches "{query}". Try another word, such as theme, font, reciter or notification.</li>
        {/each}
      </ul>
    {:else if showChanged}
      <ul class="results changed" aria-label="Changed settings">
        {#each changedRows as r (r.area + r.title)}
          <li>
            <button class="go" onclick={() => openResult(r)}><b>{r.title}</b><small>{areaName(r.area)}</small></button>
            <button class="again" onclick={() => resetRow(r.title)}>Reset</button>
          </li>
        {:else}
          <li class="none">Everything is at its default. Settings you change will be listed here.</li>
        {/each}
      </ul>
      {#if changedRows.length}
        <div class="row"><div class="label"><h3>Reset everything</h3><p>Sends every setting back to its default in one step.</p></div><button class="secondary" onclick={resetSettings}>Reset all…</button></div>
      {/if}
    {:else if ui.area === 'appearance'}
      <h3 class="grp">Colour</h3>
      <div class="card">
      <div class="row wide">
        <div class="label"><h3>Theme</h3>{@render rst('Theme')}<p>{THEMES.length} palettes, each tuned for comfortable contrast. Auto follows your system.</p></div>
        <div class="autoRow"><button class="chipauto" class:on={settings.theme === 'auto'} onclick={() => (settings.theme = 'auto')}>Match system (light or dark)</button></div>
        <div class="themes">
          {#each THEMES as t (t.id)}
            <button class="theme" class:on={settings.theme === t.id} onclick={() => (settings.theme = t.id)} aria-label="{t.name} theme">
              <span class="sw" style:background={t.bg}>
                <span class="ink" style:color={t.ink}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>
                <i style:background={t.accent}></i>
              </span>
              <b>{t.name}</b>
            </button>
          {/each}
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Interface size</h3>{@render rst('Interface size')}<p>Makes the menus, lists, buttons and every other piece of interface text bigger or smaller. Currently {Math.round(settings.uiScale * 100)}%. The Arabic text has its own size under Arabic text.</p></div>
        <div class="seg" role="radiogroup" aria-label="Interface size">
          {#each UI_SIZES as u (u)}
            <button role="radio" aria-checked={settings.uiScale === u} class:on={settings.uiScale === u} onclick={() => (settings.uiScale = u)}>{u === 1 ? 'Default' : `${Math.round(u * 100)}%`}</button>
          {/each}
          <label class="custom" class:on={!UI_SIZES.includes(settings.uiScale)}>
            <input type="number" min="50" max="200" step="1" inputmode="numeric" placeholder="Custom" aria-label="Custom interface size in percent"
              value={UI_SIZES.includes(settings.uiScale) ? '' : Math.round(settings.uiScale * 100)}
              onchange={(e) => {
                const n = parseFloat(e.currentTarget.value);
                if (Number.isFinite(n)) settings.uiScale = Math.min(2, Math.max(0.5, Math.round(n) / 100));
                else e.currentTarget.value = '';
              }} />%
          </label>
        </div>
      </div>
      </div>
      <h3 class="grp">Names</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Surah names in Arabic</h3>{@render rst('Surah names in Arabic')}<p>Show the Arabic name first in the list and player.</p></div>
        {@render toggle(settings.arabicNames, (v) => (settings.arabicNames = v), 'Arabic surah names')}
      </div>
      </div>
    {/if}

    {#if browse && onPage('mushaf')}
      {@render preview()}
      <h3 class="grp">Arabic script</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Mushaf</h3>{@render rst('Mushaf')}<p>How the Arabic is written. The Madani and IndoPak pages are the exact printed Mushaf (Madani: 604 pages; IndoPak: 610, with its own spelling), fetched once per page, then kept for offline use. Text fonts show plain text in the font you pick.</p></div>
        <div class="seg">
          <button class:on={mushafChoice === 'madani'} onclick={() => setMushaf('madani')}>Madani pages</button>
          <button class:on={mushafChoice === 'indopak'} onclick={() => setMushaf('indopak')}>IndoPak pages</button>
          <button class:on={mushafChoice === 'text'} onclick={() => setMushaf('text')}>Text fonts</button>
        </div>
      </div>
      {#if mushafChoice === 'text'}
      <div class="row wide">
        <div class="label"><h3>Font</h3><p>Every card shows the same verse.</p></div>
        <div class="scripts">
          {#each SCRIPTS.filter((sc) => sc.id !== 'mushaf' && (sc.id !== 'indopak' || settings.pageType === 'madani')) as sc (sc.id)}
            <button class="script" class:on={settings.script === sc.id} onclick={() => setFont(sc.id)} aria-pressed={settings.script === sc.id}>
              <span class="sample" class:tajweed={sc.id === 'tajweed'} dir="rtl" style:font-family={sc.family}>
                {#if sc.id === 'tajweed'}{@html sample('tajweed')}{:else}{sample(sc.id)}{/if}
              </span>
              <b>{sc.name}</b><small>{sc.hint}</small>
            </button>
          {/each}
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Page layout</h3>{@render rst('Page layout')}<p>Which printed Mushaf the pages follow: same text, different line breaks and page numbers.</p></div>
        <div class="seg">
          <button class:on={settings.pageType === 'madani'} onclick={() => (settings.pageType = 'madani')}>Madani (604)</button>
          <button class:on={settings.pageType === 'indopak'} onclick={() => (settings.pageType = 'indopak')}>IndoPak (610)</button>
        </div>
      </div>
      {/if}
      </div>
      <h3 class="grp">Size</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Text size</h3>{@render rst('Text size')}<p>{settings.size}px, for Verse by Verse. Mushaf pages always fill the page.</p></div>
        <input type="range" min="24" max="96" step="2" bind:value={settings.size} style:--p="{(settings.size - 24) / 72 * 100}%" aria-label="Text size" />
      </div>
      <div class="row">
        <div class="label"><h3>Line spacing</h3>{@render rst('Line spacing')}<p>{settings.spacing.toFixed(1)}</p></div>
        <input type="range" min="1.3" max="3.2" step="0.1" bind:value={settings.spacing} style:--p="{(settings.spacing - 1.3) / 1.9000000000000001 * 100}%" aria-label="Line spacing" />
      </div>
      </div>

    {#if browse && onPage('translation')}
      <h3 class="grp">Start</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Open in</h3>{@render rst('Open in')}<p>What you see first. Switch any time from the top bar.</p></div>
        <div class="seg">
          <button class:on={settings.mode === 'reading'} onclick={() => (settings.mode = 'reading')}>Reading</button>
          <button class:on={settings.mode === 'verse'} onclick={() => (settings.mode = 'verse')}>Verse by Verse</button>
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Continue where I left off</h3>{@render rst('Continue where I left off')}<p>Reopen at the surah and verse you were reading. Off: start from the beginning of Al-Fatihah.</p></div>
        {@render toggle(settings.resume, (v) => (settings.resume = v), 'Continue where I left off')}
      </div>
      </div>
      <h3 class="grp">Translation</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Translation</h3>{@render rst('Translation')}<p>Shown under each verse and in Reading → Translation. Saved with the surah for offline use.</p></div>
        <TranslationPicker onpick={setTranslation} />
      </div>
      <div class="row">
        <div class="label"><h3>Tafsir edition</h3><p>Follows the translation language by default. Choose another edition anytime.</p></div>
        <div class="stack"><TafsirPicker onpick={setTafsirEdition} onauto={followTranslationTafsir} />
          {#if tafsirLanguageMismatch}<small class="status">{settings.tafsirAutoFollow ? 'No matching edition; using ' : 'Selected '}{tafsirs.get(settings.tafsirEdition)?.language_name} tafsir.</small>{/if}
        </div>
      </div>
      {#if settings.translation}
        <div class="row">
          <div class="label"><h3>Translation and tafsir text size</h3>{@render rst('Translation and tafsir text size')}<p>{settings.translationSize}px</p></div>
          <input type="range" min="13" max="30" step="1" bind:value={settings.translationSize} style:--p="{(settings.translationSize - 13) / 17 * 100}%" aria-label="Translation and tafsir text size" />
        </div>
      {/if}
      </div>
      <h3 class="grp">Word by word</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Word meanings</h3>{@render rst('Word meanings')}<p>Word-by-word translation in Verse by Verse. Right-click any word to see its meaning and play options.</p></div>
        <div class="seg">
          {#each MEANINGS as m (m.id)}
            <button class:on={settings.wordMeaning === m.id} onclick={() => (settings.wordMeaning = m.id)}>{m.name}</button>
          {/each}
        </div>
      </div>
      {#if settings.wordMeaning === 'below'}
        <div class="row wide">
          <div class="label"><h3>Transliteration</h3>{@render rst('Transliteration')}<p>Show how each word is pronounced, in Latin letters.</p></div>
          {@render toggle(settings.transliteration, (v) => (settings.transliteration = v), 'Transliteration')}
        </div>
      {/if}
      </div>
    {/if}

      <p class="intro">These options are for <b>Reading</b> mode, the printed Mushaf pages. Verse by Verse ignores them.</p>
      <h3 class="grp">Page</h3>
      <div class="card">
      <div class="row wide">
        <div class="label"><h3>Page look</h3>{@render rst('Page look')}<p>The paper the Mushaf page is drawn on.</p></div>
        <div class="looks">
          {#each LOOKS as l (l.id)}
            <button class="look" class:on={settings.pageLook === l.id} onclick={() => (settings.pageLook = l.id)} aria-pressed={settings.pageLook === l.id}>
              <span class="mini {l.id}"><i></i><i></i><i></i><i></i><i></i></span>
              <b>{l.name}</b><small>{l.hint}</small>
            </button>
          {/each}
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Page flow</h3>{@render rst('Page flow')}<p>Turn one page at a time, or scroll the pages like a long sheet.</p></div>
        <div class="seg">
          <button class:on={settings.flow === 'page'} onclick={() => (settings.flow = 'page')}>Pages</button>
          <button class:on={settings.flow === 'scroll'} onclick={() => (settings.flow = 'scroll')}>Scroll</button>
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Two-page spread</h3>{@render rst('Two-page spread')}<p>Show facing pages like an open book: odd pages on the right, even on the left. Needs a wide window. Press T.</p></div>
        {@render toggle(settings.spread, (v) => (settings.spread = v), 'Two-page spread')}
      </div>
      <div class="row">
        <div class="label"><h3>Continuous book</h3>{@render rst('Continuous book')}<p>Pages run on across surahs like a printed Mushaf; scrolling or turning past the end opens the next surah.</p></div>
        {@render toggle(settings.continuous, (v) => { settings.continuous = v; reader.reset(); }, 'Continuous book')}
      </div>
      </div>
      <h3 class="grp">On the page</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Page info</h3>{@render rst('Page info')}<p>Show the surah name, juz and page number on each page.</p></div>
        {@render toggle(settings.showPageInfo, (v) => (settings.showPageInfo = v), 'Page info')}
      </div>
      <div class="row">
        <div class="label"><h3>Highlight bookmarks</h3>{@render rst('Highlight bookmarks')}<p>Mark bookmarked verses with a filled verse-end ornament.</p></div>
        {@render toggle(settings.highlightBookmarks, (v) => (settings.highlightBookmarks = v), 'Highlight bookmarks')}
      </div>
      </div>
    {/if}

    {#if browse && onPage('listening')}
      <h3 class="grp">Player</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Player bar</h3>{@render rst('Player bar')}<p>On demand: opens when you press Listen or play a verse, slides up when the mouse is at the bottom edge, and ✕ closes it. Always: docked and always shown. Auto-hide: always available, shown only when the mouse is at the bottom edge.</p></div>
        <div class="seg">
          <button class:on={settings.playerBar === 'demand'} onclick={() => (settings.playerBar = 'demand')}>On demand</button>
          <button class:on={settings.playerBar === 'always'} onclick={() => (settings.playerBar = 'always')}>Always</button>
          <button class:on={settings.playerBar === 'autohide'} onclick={() => (settings.playerBar = 'autohide')}>Auto-hide</button>
        </div>
      </div>
      </div>
      <h3 class="grp">Recitation</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Reciter</h3><p>Switching keeps your place in the surah.</p></div>
        <div class="rp-wrap"><ReciterPicker /></div>
      </div>
      <div class="row">
        <div class="label"><h3>Playback speed</h3>{@render rst('Playback speed')}<p>Pitch is preserved.</p></div>
        <div class="seg">
          {#each SPEEDS as sp (sp)}
            <button class:on={settings.speed === sp} onclick={() => { settings.speed = sp; player.applySpeed(); }}>{sp}×</button>
          {/each}
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Play the next surah</h3>{@render rst('Play the next surah')}<p>Continue automatically when a surah ends.</p></div>
        {@render toggle(settings.autoAdvance, (v) => (settings.autoAdvance = v), 'Auto-advance')}
      </div>
      <div class="row">
        <div class="label"><h3>Repeat surah</h3>{@render rst('Repeat surah')}<p>Loop the current surah, handy for memorising. Also the repeat button in the player.</p></div>
        {@render toggle(settings.repeatSurah, (v) => (settings.repeatSurah = v), 'Repeat surah')}
      </div>
      <div class="row">
        <div class="label"><h3>Say a word when clicked</h3>{@render rst('Say a word when clicked')}<p>Clicking a word plays just that word, with no menu. Needs a connection unless the surah is downloaded.</p></div>
        {@render toggle(settings.wordAudio, (v) => (settings.wordAudio = v), 'Word audio')}
      </div>
      <div class="row">
        <div class="label"><h3>Saved offline content</h3><p>{mb(usedBytes + tafsirUsedBytes)} MB stored on this device. Manage saved audio and tafsir in the Offline manager.</p></div>
        <button class="secondary" onclick={() => (ui.area = 'offline')}>Open the Offline manager…</button>
      </div>
      </div>
      <h3 class="grp">Following along</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Follow the recitation</h3>{@render rst('Follow the recitation')}<p>Follow keeps the current verse in view; scrolling yourself pauses it for a moment. Lock to verse returns the view to the verse being recited whenever you let go of the scroll (scrolling views). Also on the lock button in the bar above the text.</p></div>
        <div class="seg">
          <button class:on={settings.follow === 'off'} onclick={() => (settings.follow = 'off')}>Off</button>
          <button class:on={settings.follow === 'follow'} onclick={() => (settings.follow = 'follow')}>Follow</button>
          <button class:on={settings.follow === 'lock'} onclick={() => (settings.follow = 'lock')}>Lock to verse</button>
        </div>
      </div>
      </div>
    {/if}

    {#if browse && onPage('offline')}
      <div class="offline-columns"><section class="offline-col">
      <h3 class="grp">Audio</h3>
      <div class="row mgr">
        <div class="label"><h3>Reciter to manage</h3><p>First choose a reciter, then download or delete the surahs you want. Each reciter's recitations are stored separately.</p></div>
        <div class="rp-wrap"><ReciterPicker value={dlReciter} onpick={(id) => (dlReciter = id)} /></div>
      </div>
      <div class="row">
        <div class="label"><h3>Keep favourites offline</h3>{@render rst('Keep favourites offline')}<p>A surah you listen to on three different days in a month is saved for offline use by itself. If you do not listen to it for {KEEP_DAYS} days, it is removed again. Recitations you download yourself are never removed.</p></div>
        {@render toggle(settings.autoCache, (v) => (settings.autoCache = v), 'Keep favourites offline')}
      </div>
      <div class="row">
        <div class="label"><h3>{have.length} of {player.chapters.length || 114} surahs</h3><p>{mb(haveBytes)} MB stored for {dlName}.</p></div>
        <div class="stack">
          <div class="inline">
            {#if working}
              <button class="secondary" onclick={() => player.cancelDownloads()}>Stop</button>
            {:else}
              <button class="primary" onclick={downloadAll} disabled={player.dl.running || have.length === player.chapters.length}>Download all</button>
            {/if}
            <button class="danger" onclick={deleteAll} disabled={!have.length || working}>Delete all…</button>
          </div>
          {#if player.dl.reciter === dlReciter && (player.dl.running || player.dl.total)}
            <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(player.bulkProgress * 100)} aria-label="Download progress"><i style:width="{player.bulkProgress * 100}%"></i></div>
            <small class="status" role="status">
              {#if player.dl.running}Downloading {player.dl.done} of {player.dl.total} · {Math.round(player.bulkProgress * 100)}%{:else if player.dl.failed}Finished, but {player.dl.failed} could not be downloaded. Run Download all again to retry.{:else}All done.{/if}
            </small>
          {/if}
        </div>
      </div>
      <div class="row dlhead">
        <div class="label"><h3>Recitations by {dlName}</h3></div>
        <div class="seg">
          <button class:on={!onlyDownloaded} onclick={() => (onlyDownloaded = false)}>All</button>
          <button class:on={onlyDownloaded} onclick={() => (onlyDownloaded = true)}>Downloaded</button>
        </div>
      </div>
      <ul class="dls">
        {#each listed as c (c.id)}
          {@const got = player.isDownloadedFor(dlReciter, c.id)}
          {@const busy = player.dl.running && player.dl.reciter === dlReciter && player.dl.current.includes(c.id)}
          {@const one = player.downloading === c.id && dlReciter === player.reciterId}
          {@const pr = player.progress[`${dlReciter}:${c.id}`] ?? 0}
          <li>
            <span class="num">{c.id}</span>
            <span class="nm"><b>{c.name_simple}</b><small>{c.translated_name.name} · {c.verses_count} verses{#if got && autocache.isAuto(`${dlReciter}:${c.id}`)}{' · '}<span class="auto" title="Saved because you listen to it regularly. Removed after {KEEP_DAYS} days without listening.">kept automatically, {autocache.daysLeft(`${dlReciter}:${c.id}`)} days left</span>{/if}</small></span>
            <span class="sz">{got ? `${mb(sizes.get(`${dlReciter}:${c.id}`) ?? 0)} MB` : ''}</span>
            {#if got}
              <button class="secondary sm" onclick={() => deleteOne(c.id, c.name_simple)} aria-label="Delete {c.name_simple}">Delete</button>
            {:else if busy || one}
              <span class="sm wait" role="status">{#if pr > 0}<span class="dlbar" aria-hidden="true"><i style:width="{pr * 100}%"></i></span><b>{Math.round(pr * 100)}%</b>{:else}Downloading…{/if}</span>
            {:else}
              <button class="secondary sm" onclick={() => player.downloadMany(dlReciter, [c.id])} disabled={player.dl.running} aria-label="Download {c.name_simple}">Download</button>
            {/if}
          </li>
        {:else}
          <li class="none">Nothing downloaded for {dlName} yet.</li>
        {/each}
      </ul>

      </section><section class="offline-col">
      <h3 class="grp">Tafsir</h3>
      <div class="row mgr"><div class="label"><h3>Tafsir edition</h3><p>Download and remove surah tafsir for the selected edition. Saved items are available offline.</p></div><div class="stack"><TafsirPicker disabled={tafsirBulk.running || Boolean(tafsirBusy)} onpick={setTafsirEdition} onauto={followTranslationTafsir} />{#if tafsirLanguageMismatch}<small class="status">{settings.tafsirAutoFollow ? 'No matching edition; using ' : 'Selected '}{tafsirs.get(settings.tafsirEdition)?.language_name} tafsir.</small>{/if}</div></div>
      <div class="row dlhead">
        <div class="label"><h3>{tafsirHave.length} of {player.chapters.length || 114} surahs</h3><p>{mb(tafsirHave.reduce((sum, c) => sum + (tafsirDownloads.get(`${settings.tafsirEdition}:${c.id}`) ?? 0), 0))} MB stored for this edition · {mb(tafsirUsedBytes)} MB total tafsir.</p></div>
        <div class="stack">
          <div class="inline">
            {#if tafsirBulk.running}
              <button class="secondary" onclick={() => tafsirController?.abort()}>Stop</button>
            {:else}
              <button class="primary" onclick={downloadAllTafsir} disabled={!settings.tafsirEdition || tafsirHave.length === player.chapters.length || Boolean(tafsirBusy)}>Download all</button>
            {/if}
            <button class="danger" onclick={deleteAllTafsir} disabled={!tafsirHave.length || tafsirBulk.running || Boolean(tafsirBusy)}>Delete all…</button>
          </div>
          {#if tafsirBulk.running || tafsirBulk.total}
            <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={tafsirBulk.total ? Math.round(tafsirBulk.done / tafsirBulk.total * 100) : 0} aria-label="Tafsir download progress"><i style:width="{tafsirBulk.total ? tafsirBulk.done / tafsirBulk.total * 100 : 0}%"></i></div>
            <small class="status" role="status">{#if tafsirBulk.running}Downloading {tafsirBulk.done} of {tafsirBulk.total}{:else if tafsirBulk.failed}Finished, but {tafsirBulk.failed} surahs could not be downloaded. Run Download all again to retry.{:else}All done.{/if}</small>
          {/if}
          <div class="seg">
            <button class:on={!tafsirOnlyDownloaded} onclick={() => (tafsirOnlyDownloaded = false)}>All</button>
            <button class:on={tafsirOnlyDownloaded} onclick={() => (tafsirOnlyDownloaded = true)}>Downloaded</button>
          </div>
        </div>
      </div>
      {#if tafsirMessage}<p class="status" role="alert">{tafsirMessage}</p>{/if}
      <ul class="dls">
        {#each tafsirListed as c (c.id)}
          {@const key = `${settings.tafsirEdition}:${c.id}`}
          {@const got = tafsirDownloads.has(key)}
          {@const busy = tafsirBusy === key}
          <li>
            <span class="num">{c.id}</span>
            <span class="nm"><b>{c.name_simple}</b><small>{c.translated_name.name} · {c.verses_count} verses</small></span>
            <span class="sz">{got ? `${mb(tafsirDownloads.get(key) ?? 0)} MB` : ''}</span>
            {#if got}
              <button class="secondary sm" onclick={() => deleteTafsir(c.id, c.name_simple)} disabled={Boolean(tafsirBusy) || tafsirBulk.running} aria-label="Delete {c.name_simple} tafsir">Delete</button>
            {:else if busy}
              <button class="secondary sm" onclick={() => tafsirController?.abort()}>Stop</button>
            {:else if tafsirBulk.running}
              <span class="sm wait" role="status">Queued…</span>
            {:else}
              <button class="secondary sm" onclick={() => downloadTafsir(c.id)} disabled={!settings.tafsirEdition || Boolean(tafsirBusy) || tafsirBulk.running} aria-label="Download {c.name_simple} tafsir">Download</button>
            {/if}
          </li>
        {:else}
          <li class="none">No tafsir surahs downloaded for this edition.</li>
        {/each}
      </ul>
      </section></div>
    {/if}

    {#if browse && onPage('reminders')}
      <div class="card">
      <div class="row">
        <div class="label"><h3>Verse of the day</h3>{@render rst('Verse of the day')}<p>One verse from quran.com each day, from the time you choose: a card in the app, or a notification when the window is behind other apps or in the tray.</p></div>
        {@render toggle(settings.dailyVerse, (v) => (settings.dailyVerse = v), 'Verse of the day')}
      </div>
      {#if settings.dailyVerse}
        <div class="row">
          <div class="label"><h3>Show it from</h3>{@render rst('Show it from')}<p>It appears at this time while the app is running (in the tray too), or the first time you open the app after it.</p></div>
          <input class="time" type="time" bind:value={settings.dailyVerseTime} aria-label="Verse of the day time" />
        </div>
      {/if}
      <div class="row">
        <div class="label"><h3>Reading reminders</h3>{@render rst('Reading reminders')}<p>A nudge at the times below, as long as the app is running.</p></div>
        {@render toggle(settings.remindersOn, (v) => (settings.remindersOn = v), 'Reading reminders')}
      </div>
      {#if settings.remindersOn}
        <div class="row">
          <div class="label"><h3>Times</h3>{@render rst('Times')}<p>Every day. Add as many as you like.</p></div>
          <div class="times">
            {#each times as t, i (i)}
              <span class="tm">
                <input class="time" type="time" value={t.padStart(5, '0')} onchange={(e) => e.currentTarget.value && setTime(i, e.currentTarget.value)} aria-label="Reminder time {i + 1}" />
                <button class="rm" onclick={() => removeTime(i)} aria-label="Remove {t}">
                  <svg aria-hidden="true" viewBox="0 0 10 10" width="10" height="10"><path d="M.5.5l9 9M9.5.5l-9 9" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
                </button>
              </span>
            {/each}
            <button class="secondary" onclick={addTime}>+ Add a time</button>
          </div>
        </div>
        <div class="row">
          <div class="label"><h3>Message</h3>{@render rst('Message')}<p>What the reminder says.</p></div>
          <input class="text" type="text" maxlength="120" bind:value={settings.remindMessage} aria-label="Reminder message" />
        </div>
      {/if}
      <div class="row">
        <div class="label"><h3>Use system notifications</h3>{@render rst('Use system notifications')}<p>When the window is behind other apps or in the tray, notify through Windows or macOS as well. Do Not Disturb and Focus still apply.</p></div>
        {@render toggle(settings.systemNotify, (v) => (settings.systemNotify = v), 'System notifications')}
      </div>
      </div>
    {/if}

    {#if browse && onPage('app')}
      <h3 class="grp">Window</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Full screen</h3><p>Use the whole display without changing the layout.</p></div>
        <button class="secondary" onclick={() => ui.toggleFullscreen()}>{ui.fullscreen ? 'Exit full screen' : 'Enter full screen'}</button>
      </div>
      <div class="row">
        <div class="label"><h3>Keep the screen on</h3>{@render rst('Keep the screen on')}<p>Stop the display sleeping while a recitation plays.</p></div>
        {@render toggle(settings.keepAwake, (v) => (settings.keepAwake = v), 'Keep screen on')}
      </div>
      <div class="row">
        <div class="label"><h3>Show tips</h3>{@render rst('Show tips')}<p>Now and then a small card offers a setting that suits what you are doing, such as keeping the player in view. Switch off to never see them; switching on again brings them back.</p></div>
        {@render toggle(settings.tips, (v) => hints.enable(v), 'Show tips')}
      </div>
      </div>
      {#if isTauri()}
        <h3 class="grp">Background</h3>
        <div class="card">
        <div class="row">
          <div class="label"><h3>Keep running in the tray</h3>{@render rst('Keep running in the tray')}<p>Closing the window leaves Quran in the system tray, so reminders and the verse of the day still arrive. Click the tray icon to open it again, or right-click it to quit. Off: closing the window quits.</p></div>
          {@render toggle(settings.background, (v) => (settings.background = v), 'Keep running in the tray')}
        </div>
        <div class="row">
          <div class="label"><h3>Start with the computer</h3><p>Starts quietly in the tray when you sign in, without opening a window.</p></div>
          {@render toggle(autostart, toggleAutostart, 'Start with the computer')}
        </div>
        </div>
      {/if}

      <h3 class="grp">Keyboard shortcuts</h3>
      <div class="card">
      <div class="row wide">
        <div class="label"><h3>Keyboard</h3><p>Everything is reachable without the mouse.</p></div>
        <dl class="keys">
          <dt>Space</dt><dd>Play or pause</dd>
          <dt>Page Up / Down</dt><dd>Previous or next page</dd>
          <dt>← →</dt><dd>Turn the page, or step verses while listening</dd>
          <dt>P</dt><dd>Verse by Verse or Reading</dd>
          <dt>R</dt><dd>Reading: Arabic or Translation</dd>
          <dt>T</dt><dd>Two-page spread</dd>
          <dt>L</dt><dd>Show or hide the listening bar</dd>
          <dt>B</dt><dd>Show or hide the surah list</dd>
          <dt>F</dt><dd>Full screen</dd>
          <dt>,</dt><dd>Settings</dd>
          <dt>Esc</dt><dd>Close a menu or leave Settings</dd>
        </dl>
      </div>

      </div>
      <h3 class="grp">Updates</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Version</h3><p>{version} <span class="beta">Beta</span></p></div>
        <div class="stack">
          {#if updater.state === 'ready'}
            <button class="primary" onclick={() => updater.installAndRestart()}>Restart to update to {updater.version}</button>
          {:else}
            <button class="secondary" onclick={() => updater.check()} disabled={updater.state === 'checking' || updater.state === 'downloading'}>
              {updater.state === 'checking' ? 'Checking…' : updater.state === 'downloading' ? `Downloading ${Math.round(updater.progress * 100)}%` : 'Check for updates'}
            </button>
          {/if}
          <small class="status">
            {#if updater.state === 'uptodate'}You are on the latest version.
            {:else if updater.state === 'ready'}Downloaded. It installs when you restart or quit.
            {:else if updater.state === 'error'}Could not check: {updater.error}
            {:else if updater.state === 'unavailable'}Updates work in the installed app.
            {/if}
          </small>
          {#if updater.version && (updater.state === 'ready' || updater.state === 'downloading')}
            <div class="notes"><b>Version {updater.version}</b>{#if updater.notes}<div class="md">{#each parseNotes(updater.notes) as bl}{#if bl.kind === 'h'}<h4>{#each bl.parts as p}{p.t}{/each}</h4>{:else}<p class:li={bl.kind === 'li'}>{#each bl.parts as p}{#if p.b}<strong>{p.t}</strong>{:else if p.c}<code>{p.t}</code>{:else}{p.t}{/if}{/each}</p>{/if}{/each}</div>{/if}</div>
          {/if}
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Update automatically</h3>{@render rst('Update automatically')}<p>New versions download quietly in the background. You only restart to finish.</p></div>
        {@render toggle(settings.checkUpdates, (v) => (settings.checkUpdates = v), 'Update automatically')}
      </div>

      </div>
      <h3 class="grp">Your data</h3>
      <div class="card">
      <div class="row">
        <div class="label"><h3>Offline downloads</h3><p>{mb(usedBytes)} MB of audio and {mb(tafsirUsedBytes)} MB of tafsir stored on this device.</p></div>
        <button class="secondary" onclick={() => (ui.area = 'offline')}>Open the Offline manager…</button>
      </div>
      <div class="row">
        <div class="label"><h3>Bookmarks</h3><p>{bookmarks.list.length} saved. Export a copy, or merge one back in.</p></div>
        <div class="stack">
          <div class="inline">
            <button class="secondary" onclick={exportBookmarks} disabled={!bookmarks.list.length}>Export…</button>
            <label class="secondary file">Import…<input type="file" accept="application/json,.json" onchange={importBookmarks} hidden /></label>
          </div>
          {#if importMsg}<small class="status">{importMsg}</small>{/if}
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Reset settings</h3><p>Restore every setting to its default. Downloads are kept.</p></div>
        <button class="secondary" onclick={resetSettings}>Reset to defaults…</button>
      </div>

      </div>
      <h3 class="grp">About</h3>
      <div class="card">
      <div class="row about">
        <div class="label"><h3>About</h3></div>
        <div class="about-content">
          <div class="about-intro">
            <span class="about-kicker">Quran Desktop</span>
            <h2>A quieter space for reading and listening.</h2>
            <p>Free and open source, with no ads or locked features. This beta is built on the ideas of <a href="https://github.com/quran/quran_android" target="_blank" rel="noreferrer">Quran for Android</a>. Quran text, timings and audio are provided by the Quran.com public API.</p>
          </div>
          <div class="about-links" aria-label="App links">
            <a class="about-link" href="https://qurandesktop.pages.dev" target="_blank" rel="noreferrer">
              <span class="about-link-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3a11 11 0 0 1 0 14M10 3a11 11 0 0 0 0 14"/></svg></span><span><b>App website</b><small>qurandesktop.pages.dev</small></span><span class="about-arrow" aria-hidden="true">↗</span>
            </a>
            <a class="about-link" href="https://github.com/Obscyra/quran-desktop" target="_blank" rel="noreferrer">
              <span class="about-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.1c-3.1.68-3.76-1.32-3.76-1.32-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.7 2.62 1.21 3.26.92.1-.72.39-1.21.71-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.12-1.44 3.05-1.15 3.05-1.15.61 1.54.23 2.68.12 2.96.71.78 1.14 1.78 1.14 3 0 4.29-2.61 5.23-5.1 5.51.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9z"/></svg></span><span><b>Source code</b><small>Browse the project on GitHub</small></span><span class="about-arrow" aria-hidden="true">↗</span>
            </a>
            <a class="about-link" href="https://github.com/Obscyra/quran-desktop/issues/new?template=feature.yml" target="_blank" rel="noreferrer">
              <span class="about-link-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M10 3v14M3 10h14"/></svg></span><span><b>Suggest a feature</b><small>Share an idea for the app</small></span><span class="about-arrow" aria-hidden="true">↗</span>
            </a>
            <a class="about-link" href="https://github.com/Obscyra/quran-desktop/issues/new?template=bug.yml" target="_blank" rel="noreferrer">
              <span class="about-link-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M10 3 18 17H2L10 3Z"/><path d="M10 7v4m0 3h.01"/></svg></span><span><b>Report a problem</b><small>Help improve this beta</small></span><span class="about-arrow" aria-hidden="true">↗</span>
            </a>
          </div>
          <ul class="credits" aria-label="Credits">
            <li>Manrope by Mikhail Sharanda — SIL Open Font License 1.1</li>
            <li>Inter by Rasmus Andersson — SIL Open Font License 1.1</li>
            <li>Icons: Lucide — ISC License</li>
            <li>Surah name calligraphy and Madinah surah frame: QUL by Tarteel (qul.tarteel.ai)</li>
          </ul>
        </div>
      </div>
      <div class="row about">
        <div class="label"><h3>Developer</h3><p>Made and maintained by one person.</p></div>
        <div class="dev-card">
          <div class="dev-heading"><span class="dev-avatar" aria-hidden="true">FS</span><span><b>Fahim Shahriar</b><small>Developer · Maintainer</small></span></div>
          <div class="about-links dev-links" aria-label="Developer links">
          <a class="about-link" href="mailto:fahimonlinux@gmail.com"><span class="about-link-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><rect x="2.5" y="4" width="15" height="12" rx="2"/><path d="m3.5 5 6.5 5 6.5-5"/></svg></span><span><b>Email</b><small>fahimonlinux@gmail.com</small></span><span class="about-arrow" aria-hidden="true">↗</span></a>
            <a class="about-link" href="https://github.com/Obscyra" target="_blank" rel="noreferrer"><span class="about-link-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.1c-3.1.68-3.76-1.32-3.76-1.32-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.7 2.62 1.21 3.26.92.1-.72.39-1.21.71-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.12-1.44 3.05-1.15 3.05-1.15.61 1.54.23 2.68.12 2.96.71.78 1.14 1.78 1.14 3 0 4.29-2.61 5.23-5.1 5.51.4.35.76 1.03.76 2.08v3.08c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9z"/></svg></span><span><b>GitHub</b><small>github.com/Obscyra</small></span><span class="about-arrow" aria-hidden="true">↗</span></a>
            <a class="about-link" href="https://fahimshahriar.pages.dev" target="_blank" rel="noreferrer"><span class="about-link-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3a11 11 0 0 1 0 14M10 3a11 11 0 0 0 0 14"/></svg></span><span><b>Website</b><small>fahimshahriar.pages.dev</small></span><span class="about-arrow" aria-hidden="true">↗</span></a>
          </div>
        </div>
      </div>
      </div>
    {/if}
  </div></div>
</section>

<style>
  .settings { flex: 1; display: flex; min-width: 0; background: var(--bg); overflow: hidden; }
  nav { width: 220px; overflow-y: auto; flex: none; padding: 16px 12px; display: flex; flex-direction: column; gap: 4px; background: var(--chrome); border-right: 1px solid var(--hair); }

  .find { position: relative; display: block; margin: 0 0 10px; }
  .find svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--ink-dim); pointer-events: none; }
  .find input { width: 100%; height: 36px; padding: 0 12px 0 33px; border-radius: var(--r-md); border: 0; background: color-mix(in oklab, var(--ink) 5%, transparent); color: var(--ink); font: inherit; font-size: var(--t-meta); }
  .find input::placeholder { color: var(--ink-dim); }
  .find input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .results { list-style: none; margin: 0; padding: 0; display: grid; }
  nav .chg { flex-direction: row; width: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 0 6px; padding: 8px 12px; height: auto; border-radius: var(--r-md); font-size: var(--t-meta); color: var(--muted); border: 1px dashed var(--hair-2); text-align: left; }
  nav .chg b { min-width: 20px; padding: 1px 7px; border-radius: var(--r-pill); text-align: center; font-size: var(--t-meta); font-weight: 600; background: var(--accent-soft); color: var(--accent); }
  nav .chg:hover { color: var(--ink); }
  nav .chg.on { color: var(--accent); border-style: solid; border-color: transparent; background: var(--btn-on); }
  .results.changed li { display: flex; align-items: center; gap: 8px; }
  .results.changed .go { flex: 1; }
  .results.changed .again, .reset { flex: none; width: auto; display: inline-block; padding: 3px 10px; border-radius: var(--r-md); font-size: var(--t-meta); color: var(--accent); background: var(--btn-on); }
  .results.changed .again:hover, .reset:hover { background: var(--sel); }
  .label { position: relative; }
  .reset { position: absolute; top: -1px; right: 0; }
  .results li + li { border-top: 1px solid var(--line); }
  .results button { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; width: 100%; padding: 14px 8px; text-align: left; border-radius: var(--r-md); }
  .results button:hover { background: color-mix(in oklab, var(--ink) 7%, transparent); }
  .results b { font-weight: 550; font-size: var(--t-body); }
  .results small { color: var(--ink-dim); font-size: var(--t-meta); }
  .results .none { padding: 18px 8px; color: var(--ink-dim); font-size: var(--t-body); }
  .row.flash { animation: flash 1.8s var(--ease); border-radius: var(--r-md); }
  @keyframes flash { 0%, 55% { background: var(--accent-soft); box-shadow: 0 0 0 10px var(--accent-soft); } 100% { background: transparent; box-shadow: 0 0 0 10px transparent; } }
  .grp { font-size: var(--t-cap); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0 0 8px 2px; }
  .card { background: var(--ink-4); border: 1px solid var(--hair); border-radius: var(--r-lg); margin-bottom: 28px; }
  .lede { font-size: var(--t-meta); color: var(--muted); margin: 0 0 28px; }

  nav h1 { font-size: var(--t-title); font-weight: 600; letter-spacing: -0.01em; padding: 4px 12px 14px; }
  nav button { display: flex; align-items: center; gap: 10px; height: var(--nav-set); flex: none; padding: 0 12px; border-radius: var(--r-md); font-size: var(--t-body); font-weight: 500; color: var(--muted); text-align: left; transition: background 0.2s, color 0.2s; }
  nav button:hover { background: var(--ink-4); color: var(--ink); }
  nav button.on { background: color-mix(in oklab, var(--accent) 13%, transparent); color: var(--ink); }
  nav button.on svg { color: var(--accent); }

  .view { flex: 1; min-width: 0; overflow-y: auto; padding: 0 24px 64px; }
  .col { max-width: 640px; margin: 0 auto; }
  header { display: flex; align-items: center; gap: 14px; position: sticky; top: 0; background: var(--bg); padding: 40px 0 8px; z-index: 2; }
  header h2 { font-size: var(--t-title); font-weight: 600; letter-spacing: -0.01em; flex: 1; }
  .back { width: 34px; height: 34px; border-radius: var(--r-md); display: grid; place-items: center; color: var(--ink-dim); margin-left: -8px; }
  .back:hover { background: color-mix(in oklab, var(--ink) 9%, transparent); color: var(--ink); }
  .saved { color: var(--accent); font-size: var(--t-body); opacity: 0; transition: opacity 0.4s; }
  .saved.show { opacity: 1; }
  .close { height: 32px; padding: 0 16px; border-radius: var(--r-md); background: var(--accent); color: var(--accent-ink); font-size: var(--t-body); font-weight: 600; }

  .row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 16px; min-height: var(--row-set); padding: 12px 16px; }
  .row > .label { flex: 1 1 220px; min-width: 0; }
  .row.about { flex-direction: column; align-items: stretch; flex-wrap: nowrap; }
  .row + .row, .dlhead + .dls { border-top: 1px solid var(--hair); }
  /* big pickers (themes, scripts, page types, shortcuts) get the full width under their label */
  .row.wide { flex-direction: column; align-items: stretch; flex-wrap: nowrap; }
  .row.wide > .label, .row.about > .label { flex: none; }
  .row.wide .label p { max-width: 62ch; }
  .view { container-type: inline-size; }
  @container (max-width: 560px) { .about-links { grid-template-columns: 1fr; } .about-intro { padding: 17px; } }
  .label h3 { font-size: var(--t-body); font-weight: 500; }
  .label p { margin-top: 2px; color: var(--muted); font-size: var(--t-meta); line-height: 1.45; max-width: 46ch; }
  .times { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .tm { display: inline-flex; align-items: center; gap: 2px; }
  .time, .text { background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: var(--r-md); padding: 8px 10px; font: inherit; color-scheme: inherit; }
  .text { min-width: 280px; max-width: 100%; user-select: text; }
  .rm { width: 26px; height: 26px; border-radius: var(--r-sm); display: grid; place-items: center; color: var(--ink-dim); }
  .rm:hover { background: color-mix(in oklab, var(--ink) 10%, transparent); color: var(--ink); }
  .rp-wrap { justify-self: start; max-width: 100%; }


  .intro { margin: 0 0 20px; font-size: var(--t-meta); line-height: 1.5; color: var(--muted); }
  .preview { background: var(--surface); border: 1px solid var(--hair); border-radius: var(--r-lg); padding: 22px 28px; margin-bottom: 28px; text-align: center; }
  .preview p { font-family: var(--ar-font); font-size: var(--ar-size); line-height: var(--ar-lh); color: var(--ink); }
  .preview small { color: var(--ink-dim); }

  .themes { display: grid; grid-template-columns: repeat(5, 96px); justify-content: space-between; gap: 20px 0; }
  .autoRow { margin-bottom: 12px; }
  .chipauto { height: 32px; padding: 0 14px; border-radius: var(--r-md); font-size: var(--t-body); font-weight: 500; background: var(--ink-6); }
  .chipauto:hover { background: var(--btn-hover); }
  .chipauto.on { background: var(--btn-on); color: var(--accent); }
  .theme { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 96px; text-align: center; }

  .theme.on .sw { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent); }
  .theme.on b { color: var(--ink); font-weight: 500; }
  .theme .sw { position: relative; width: 96px; height: 64px; border-radius: var(--r-md); border: 1px solid var(--hair-2); display: grid; place-items: center; overflow: hidden; }
  .theme .sw .ink { font-family: 'KFGQPC Uthmanic Hafs', serif; font-size: 13px; line-height: 1.2; white-space: nowrap; direction: rtl; }
  .theme .sw i { position: absolute; left: 8px; bottom: 8px; width: 18px; height: 3px; border-radius: 2px; }
  .theme b { font-size: 12px; font-weight: 400; color: var(--muted); }

  .fonts { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
  .font { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 10px; border-radius: var(--r-lg); background: var(--surface); outline: 2px solid transparent; }
  .font.on { outline-color: var(--accent); }


  .seg { display: inline-flex; background: var(--ink-6); border-radius: var(--r-md); padding: 3px; gap: 2px; flex-wrap: wrap; }
  .seg button { height: 30px; padding: 0 12px; border-radius: var(--r-sm); font-size: var(--t-meta); font-weight: 500; color: var(--muted); transition: background-color 0.2s, color 0.2s; }
  .seg button:hover { color: var(--ink); }
  .seg .custom { display: inline-flex; align-items: center; gap: 2px; padding: 0 10px; border-radius: var(--r-sm); font-size: var(--t-meta); color: var(--muted); }
  .seg .custom.on { background: color-mix(in oklab, var(--bg) 70%, var(--ink) 12%); box-shadow: var(--e1); color: var(--ink); }
  .seg .custom input { width: 74px; background: transparent; border: 0; color: inherit; font: inherit; text-align: right; outline: none; }
  .seg .custom input:focus-visible { box-shadow: 0 1px 0 var(--accent); }
  .seg button.on { background: color-mix(in oklab, var(--bg) 70%, var(--ink) 12%); box-shadow: var(--e1); color: var(--ink); font-weight: 600; }

  input[type='range'] { -webkit-appearance: none; appearance: none; width: min(100%, 240px); height: 20px; background: transparent; }
  input[type='range']::-webkit-slider-runnable-track { height: 4px; border-radius: var(--r-pill); background: linear-gradient(var(--accent), var(--accent)) 0 / var(--p, 0%) 100% no-repeat, var(--ink-6); }
  input[type='range']::-moz-range-track { height: 4px; border-radius: var(--r-pill); background: var(--ink-6); }
  input[type='range']::-moz-range-progress { height: 4px; border-radius: var(--r-pill); background: var(--accent); }
  input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -6px; border-radius: 50%; background: var(--bg); border: 1px solid var(--hair-2); box-shadow: var(--e1); }
  input[type='range']::-moz-range-thumb { box-sizing: border-box; width: 16px; height: 16px; border-radius: 50%; background: var(--bg); border: 1px solid var(--hair-2); box-shadow: var(--e1); }
  input[type='range']:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: var(--r-sm); }

  .toggle { width: 36px; height: 20px; border-radius: var(--r-pill); background: var(--ink-6); box-shadow: inset 0 0 0 1px var(--hair); position: relative; transition: background 0.25s; flex: none; }
  .toggle i { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--ink); box-shadow: var(--e1); transition: transform 0.25s var(--ease); }
  .toggle.on { background: var(--accent); }
  .toggle.on i { transform: translateX(16px); background: var(--accent-ink); }

  .primary, .secondary, .danger { height: 32px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--r-md); font-size: var(--t-body); font-weight: 600; transition: background-color 0.15s, opacity 0.2s; }
  .primary { background: var(--accent); color: var(--accent-ink); }
  .primary:disabled, .danger:disabled { opacity: 0.5; }
  .secondary { background: var(--ink-6); color: var(--ink); }
  .secondary:hover:not(:disabled) { background: var(--btn-hover); }
  .secondary:disabled { opacity: 0.5; }
  .danger { background: color-mix(in oklab, var(--danger) 12%, transparent); color: var(--danger); }
  .danger:hover:not(:disabled) { background: color-mix(in oklab, var(--danger) 20%, transparent); }
  .prog { width: min(360px, 100%); height: 6px; border-radius: var(--r-sm); background: color-mix(in oklab, var(--ink) 14%, transparent); overflow: hidden; }
  .prog i { display: block; height: 100%; background: var(--accent); transition: width 0.3s var(--ease); }
  .dls { list-style: none; padding: 0; border-top: 1px solid var(--line); }
  .offline-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; width: min(900px, calc(100vw / var(--zoom, 1) - 220px - 48px)); margin-left: 50%; transform: translateX(-50%); align-items: stretch; }
  .offline-col { min-width: 0; padding: 0 16px 16px; border: 1px solid var(--hair); border-radius: var(--r-lg); background: var(--ink-4); }
  .offline-col .grp { margin-top: 18px; }
  .offline-col .row { flex-direction: column; align-items: flex-start; flex-wrap: nowrap; padding: 16px 0; }
  .offline-col .row > .label { flex: none; }
  .offline-col .dls li { grid-template-columns: 28px minmax(0, 1fr) auto; gap: 7px; }
  .offline-col .dls .sz { display: none; }
  .offline-col .dls .nm small { line-height: 1.35; }
  @media (max-width: 920px) { .offline-columns { grid-template-columns: 1fr; } }
  .dls li { display: grid; grid-template-columns: 34px 1fr auto 104px; gap: 12px; align-items: center; padding: 9px 4px; border-bottom: 1px solid var(--line); }
  .dls .num { color: var(--ink-dim); font-size: var(--t-meta); text-align: center; font-variant-numeric: tabular-nums; }
  .dls .nm { display: flex; flex-direction: column; min-width: 0; }
  .dls .nm b { font-weight: 550; font-size: var(--t-body); }
  .dls .nm small, .dls .sz { color: var(--ink-dim); font-size: var(--t-meta); }
  .dls .sm { height: 28px; padding: 0 12px; font-size: var(--t-meta); justify-self: end; display: inline-grid; place-items: center; }
  .dls .wait { color: var(--ink-dim); display: inline-flex; align-items: center; gap: 8px; }
  .dls .wait b { font-weight: 600; min-width: 3ch; text-align: right; font-variant-numeric: tabular-nums; color: var(--ink); }
  .dls .dlbar { width: 44px; height: 5px; border-radius: var(--r-sm); background: color-mix(in oklab, var(--ink) 14%, transparent); overflow: hidden; }
  .dls .dlbar i { display: block; height: 100%; background: var(--accent); transition: width 0.25s linear; }
  .dls .auto { color: var(--accent); }
  .dls .none { display: block; padding: 28px; text-align: center; color: var(--ink-dim); }
  .dlhead { border-top: 0 !important; padding-bottom: 10px; }
  .stack .inline button { white-space: nowrap; }
  .mgr { margin-top: 18px; border-top: 1px solid var(--line) !important; }
  .notes { max-width: 52ch; padding: 12px 14px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--line); font-size: var(--t-body); line-height: 1.55; }
  .notes .md { margin-top: 6px; color: var(--ink-dim); user-select: text; }
  .notes h4 { margin: 10px 0 3px; font-size: var(--t-body); font-weight: 600; color: var(--ink); }
  .notes .md p { margin-top: 3px; }
  .notes .md p.li { position: relative; padding-left: 14px; }
  .notes .md p.li::before { content: ''; position: absolute; left: 3px; top: 0.65em; width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }
  .notes strong { color: var(--ink); font-weight: 600; }
  .notes code { font-size: var(--t-meta); padding: 0 4px; border-radius: var(--r-sm); background: var(--btn); }
  .stack { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .status { color: var(--ink-dim); }
  .note { color: var(--ink-dim); font-size: var(--t-body); padding: 8px 0; }
  .keys { display: grid; grid-template-columns: auto 1fr; gap: 8px 18px; font-size: var(--t-body); }
  .keys dt { font-weight: 600; text-align: right; color: var(--accent); }
  .keys dd { color: var(--ink-dim); margin: 0; }
  .about-content { min-width: 0; }
  .credits { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--muted); }
  .about-intro { padding: 20px 22px; border: 1px solid var(--line); border-radius: var(--r-lg); background: linear-gradient(130deg, color-mix(in oklab, var(--accent) 9%, var(--bg-2)), var(--bg-2) 72%); box-shadow: 0 8px 24px color-mix(in oklab, var(--ink) 6%, transparent); }
  .about-kicker { display: inline-flex; padding: 4px 9px; border: 1px solid color-mix(in oklab, var(--accent) 28%, var(--line)); border-radius: var(--r-pill); color: var(--accent); font-size: var(--t-cap); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  .about-intro h2 { margin: 12px 0 7px; color: var(--ink); font-size: var(--t-title); line-height: 1.25; font-weight: 600; }
  .about-intro p { color: var(--ink-dim); line-height: 1.65; max-width: 68ch; margin: 0; }
  .about a { color: var(--accent); text-decoration: none; }
  .about-intro a { text-decoration: underline; text-decoration-color: color-mix(in oklab, var(--accent) 45%, transparent); text-underline-offset: 2px; }
  .about-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
  .about-link { min-width: 0; display: flex; align-items: center; gap: 9px; padding: 8px 9px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg-2); color: var(--ink) !important; box-shadow: 0 2px 8px color-mix(in oklab, var(--ink) 4%, transparent); transition: border-color 140ms ease, background 140ms ease, transform 140ms ease, box-shadow 140ms ease; }
  .about-link:hover { border-color: color-mix(in oklab, var(--accent) 48%, var(--line)); background: color-mix(in oklab, var(--accent) 6%, var(--bg-2)); transform: translateY(-1px); box-shadow: 0 7px 18px color-mix(in oklab, var(--ink) 8%, transparent); }
  .about-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .about-link-icon { width: 27px; height: 27px; display: grid; place-items: center; flex: none; border: 1px solid color-mix(in oklab, var(--accent) 22%, var(--line)); border-radius: var(--r-md); background: color-mix(in oklab, var(--accent) 10%, var(--bg)); color: var(--accent); }
  .about-link-icon svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  .about-link-icon svg[fill="currentColor"] { fill: currentColor; stroke: none; }
  .about-link > span:nth-child(2) { min-width: 0; display: grid; gap: 3px; }
  .about-link b { color: var(--ink); font-size: var(--t-meta); font-weight: 620; }
  .about-link small { overflow: hidden; color: var(--ink-dim); font-size: var(--t-meta); text-overflow: ellipsis; white-space: nowrap; }
  .about-arrow { margin-left: auto; align-self: flex-start; color: var(--ink-faint); font-size: var(--t-body); }
  .dev-card { padding: 12px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg-2); box-shadow: 0 6px 20px color-mix(in oklab, var(--ink) 5%, transparent); }
  .dev-heading { display: flex; align-items: center; gap: 12px; }
  .dev-avatar { width: 42px; height: 42px; display: grid; place-items: center; border-radius: var(--r-lg); background: color-mix(in oklab, var(--accent) 13%, var(--bg)); color: var(--accent); font-size: var(--t-body); font-weight: 750; letter-spacing: .04em; }
  .dev-heading > span:last-child { display: grid; gap: 4px; }
  .dev-heading b { color: var(--ink); font-size: var(--t-sub); }
  .dev-heading small { color: var(--ink-dim); font-size: var(--t-meta); }
  .dev-links { grid-template-columns: 1fr; }
  .beta { display: inline-block; margin-left: 6px; padding: 0 7px; border-radius: var(--r-pill); background: var(--accent-soft); color: var(--accent); font-size: var(--t-cap); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
  .inline { display: flex; gap: 10px; }
  .file { cursor: default; display: inline-block; }
  .preview .sample { font-size: var(--ar-size); line-height: var(--ar-lh); }
  .scripts { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .script { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 16px 12px 14px; border-radius: var(--r-lg); background: var(--surface); outline: 2px solid transparent; text-align: center; transition: outline-color 0.2s; }
  .script:hover { outline-color: var(--accent-soft); }
  .script.on { outline-color: var(--accent); }
  .script .sample { font-size: 22px; line-height: 1.8; color: var(--ink); max-width: 100%; min-height: 3.6em; display: flex; align-items: center; justify-content: center; text-align: center; text-wrap: balance; }
  .script b { font-size: var(--t-body); font-weight: 600; margin-top: 4px; }
  .script small { color: var(--ink-dim); font-size: var(--t-meta); line-height: 1.4; }
  .looks { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .look { display: flex; flex-direction: column; gap: 3px; padding: 12px; border-radius: var(--r-lg); background: color-mix(in oklab, var(--ink) 5%, transparent); outline: 2px solid transparent; text-align: left; }
  .look.on { outline-color: var(--accent); }
  .look small { color: var(--ink-dim); font-size: var(--t-meta); }
  .mini { height: 74px; border-radius: var(--r-sm); display: flex; flex-direction: column; justify-content: center; gap: 5px; padding: 0 16px; margin-bottom: 8px; position: relative; }
  .mini i { height: 3px; border-radius: var(--r-sm); background: var(--ink-dim); opacity: 0.7; }
  .mini.paper { background: var(--surface); box-shadow: var(--e1); }
  .mini.frame { background: var(--surface); outline: 1px solid color-mix(in oklab, var(--accent) 55%, transparent); outline-offset: -4px; box-shadow: inset 0 0 0 6px var(--surface), inset 0 0 0 8px color-mix(in oklab, var(--accent) 35%, transparent); }
  .mini.plain { background: transparent; border: 1px dashed var(--line); }
  .script :global([class^='tj-']) { color: inherit; }
  .script :global(.tj-ham_wasl), .script :global(.tj-laam_shamsiyah), .preview :global(.tj-ham_wasl), .preview :global(.tj-laam_shamsiyah) { color: var(--ink-faint); }
  .script :global(.tj-madda_normal), .preview :global(.tj-madda_normal) { color: #e0803a; }
  .script :global(.tj-madda_permissible), .preview :global(.tj-madda_permissible) { color: #e0a23a; }
</style>
