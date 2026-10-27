<script lang="ts">
  import ReciterPicker from './ReciterPicker.svelte';
  import TranslationPicker from './TranslationPicker.svelte';
  import { onMount, tick } from 'svelte';
  import { bookmarks } from '$lib/bookmarks.svelte';
  import { pageFonts } from '$lib/fonts.svelte';
  import { sample } from '$lib/script-sample';
  import * as offline from '$lib/offline';
  import { player } from '$lib/player.svelte';
  import { getAutostart, isTauri, setAutostart } from '$lib/platform';
  import { SCRIPTS, settings, type SettingsShape, type Highlight, type PageLook, type PageType, type Script, type WordMeaning } from '$lib/settings.svelte';
  import { THEMES } from '$lib/themes';
  import { translations } from '$lib/translations.svelte';
  import { autocache, KEEP_DAYS } from '$lib/autocache.svelte';
  import { confirm } from '$lib/confirm.svelte';
  import { notifier } from '$lib/notifications.svelte';
  import { FOCUS_MODE, ui, type SettingsArea } from '$lib/ui.svelte';
  import { updater } from '$lib/updater.svelte';

  // Each page holds one or more sections (the blocks below); a setting is found by its section, shown on its page.
  type Section = SettingsArea | 'text' | 'manager' | 'shortcuts' | 'updates';
  const AREAS: { id: SettingsArea; name: string; hint: string; group: string }[] = [
    { id: 'appearance', name: 'Appearance', hint: 'Theme, interface size, Arabic script', group: 'Look' },
    { id: 'reading', name: 'Translation & meanings', hint: 'Start view, translation, word meanings', group: 'Read' },
    { id: 'pages', name: 'Mushaf pages', hint: 'Printed page layout (Reading mode)', group: 'Read' },
    { id: 'audio', name: 'Listening', hint: 'Reciter, player, audio downloads', group: 'Listen' },
    { id: 'reminders', name: 'Reminders', hint: 'Verse of the day, reading reminders', group: 'App' },
    { id: 'focus', name: 'App & window', hint: 'Window, tray, start-up', group: 'App' },
    { id: 'data', name: 'Data & help', hint: 'Bookmarks, storage, shortcuts, reset', group: 'App' },
    { id: 'about', name: 'About', hint: 'Version, updates, developer', group: 'App' }
  ];
  const PAGE_OF: Partial<Record<Section, SettingsArea>> = { text: 'appearance', manager: 'audio', shortcuts: 'data', updates: 'about' };
  const pageOf = (s: Section) => PAGE_OF[s] ?? (s as SettingsArea);
  const onPage = (s: Section) => ui.area === pageOf(s);

  // ───── search ─────
  // every setting, with the words people may look for it by (the area it lives in is added when searching)
  const ROWS: { area: Section; title: string; text: string }[] = [
    { area: 'appearance', title: 'Theme', text: 'colour color dark light night black madinah slate paper stone gold white auto system' },
    { area: 'appearance', title: 'Interface size', text: 'zoom scale bigger smaller menus buttons' },
    { area: 'appearance', title: 'Surah names in Arabic', text: 'arabic names list player' },
    { area: 'text', title: 'Script style', text: 'font madani mushaf tajweed uthmani indopak naskh amiri scheherazade arabic writing' },
    { area: 'text', title: 'Text size', text: 'font arabic bigger larger' },
    { area: 'text', title: 'Line spacing', text: 'height lines gap' },
    { area: 'reading', title: 'Continue where I left off', text: 'resume reopen last place surah verse start remember position' },
    { area: 'reading', title: 'Open in', text: 'start view verse by verse reading mode default' },
    { area: 'reading', title: 'Translation', text: 'language english urdu meaning verse' },
    { area: 'reading', title: 'Translation size', text: 'font bigger' },
    { area: 'reading', title: 'Word meanings', text: 'word by word hover below under each word language' },
    { area: 'reading', title: 'Transliteration', text: 'pronounce latin letters' },
    { area: 'pages', title: 'Page type', text: 'madani indopak 15 lines mushaf print 604 610' },
    { area: 'pages', title: 'Page look', text: 'paper frame plain border background' },
    { area: 'pages', title: 'Page flow', text: 'scroll turn one page long sheet' },
    { area: 'pages', title: 'Two-page spread', text: 'facing book open wide T' },
    { area: 'pages', title: 'Page info', text: 'surah name juz page number header footer' },
    { area: 'pages', title: 'Highlight bookmarks', text: 'ornament marker verse end' },
    { area: 'audio', title: 'Listening bar', text: 'player bar always on demand dock' },
    { area: 'audio', title: 'Show the bar only on hover', text: 'player hide bottom edge' },
    { area: 'audio', title: 'Reciter', text: 'qari sheikh voice recitation' },
    { area: 'audio', title: 'Playback speed', text: 'faster slower rate' },
    { area: 'audio', title: 'Play the next surah', text: 'auto advance continue' },
    { area: 'audio', title: 'Repeat surah', text: 'loop memorise memorize' },
    { area: 'audio', title: 'Say a word when clicked', text: 'word audio click play' },
    { area: 'audio', title: 'Highlight style', text: 'sweep glow underline recited word' },
    { area: 'audio', title: 'Follow the recitation', text: 'auto scroll follow along' },
    { area: 'audio', title: 'Lock on the playing verse', text: 'scroll return centre center keep verse' },
    { area: 'manager', title: 'Audio manager', text: 'download delete recitation offline surah storage' },
    { area: 'manager', title: 'Keep favourites offline', text: 'auto cache save automatically' },
    { area: 'reminders', title: 'Verse of the day', text: 'daily notification card' },
    { area: 'reminders', title: 'Reading reminders', text: 'notify nudge times alarm' },
    { area: 'reminders', title: 'Use system notifications', text: 'windows macos toast do not disturb' },
    { area: 'focus', title: 'Full screen', text: 'fullscreen display F' },
    { area: 'focus', title: 'Keep the screen on', text: 'awake sleep display wake lock' },
    { area: 'focus', title: 'Keep running in the tray', text: 'background close system tray hide quit' },
    { area: 'focus', title: 'Start with the computer', text: 'autostart startup boot login sign in' },
    { area: 'shortcuts', title: 'Keyboard', text: 'shortcuts keys hotkeys commands' },
    { area: 'about', title: 'Version', text: 'about release beta software' },
    { area: 'updates', title: 'Update automatically', text: 'updates download new version' },
    { area: 'data', title: 'Offline downloads', text: 'storage space size audio' },
    { area: 'data', title: 'Bookmarks', text: 'export import backup notes' },
    { area: 'data', title: 'Reset settings', text: 'defaults restore' },
    { area: 'about', title: 'About', text: 'credits licence license open source version' },
    { area: 'about', title: 'Developer', text: 'author contact fahim shahriar github email website who made' }
  ];
  // the settings behind each row, so a row can say it was changed and go back to its default
  const ROW_KEYS: Record<string, (keyof SettingsShape)[]> = {
    'Theme': ['theme'], 'Interface size': ['uiScale'], 'Surah names in Arabic': ['arabicNames'],
    'Script style': ['script', 'pageType'], 'Text size': ['size'], 'Line spacing': ['spacing'],
    'Open in': ['mode'], 'Continue where I left off': ['resume'], 'Translation': ['translation'], 'Translation size': ['translationSize'], 'Word meanings': ['wordMeaning'], 'Transliteration': ['transliteration'],
    'Page type': ['pageType'], 'Page look': ['pageLook'], 'Page flow': ['flow'], 'Two-page spread': ['spread'], 'Page info': ['showPageInfo'], 'Highlight bookmarks': ['highlightBookmarks'],
    'Listening bar': ['listenBar'], 'Show the bar only on hover': ['playerHover'], 'Playback speed': ['speed'], 'Play the next surah': ['autoAdvance'], 'Repeat surah': ['repeatSurah'],
    'Say a word when clicked': ['wordAudio'], 'Highlight style': ['highlight'], 'Follow the recitation': ['autoScroll'], 'Lock on the playing verse': ['lockPlaying'], 'Keep favourites offline': ['autoCache'],
    'Verse of the day': ['dailyVerse'], 'Show it from': ['dailyVerseTime'], 'Reading reminders': ['remindersOn'], 'Times': ['remindTimes'], 'Message': ['remindMessage'], 'Use system notifications': ['systemNotify'],
    'Keep the screen on': ['keepAwake'], 'Keep running in the tray': ['background'], 'Update automatically': ['checkUpdates']
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
  const areaName = (id: Section) => AREAS.find((a) => a.id === pageOf(id))?.name ?? '';
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
  async function openResult(r: { area: Section; title: string }) {
    query = '';
    showChanged = false;
    ui.area = pageOf(r.area);
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
  const GROUPS = ['Look', 'Read', 'Listen', 'App'];

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

  let previewing = $state(false);
  let previewMsg = $state('');
  async function previewVerse() {
    previewing = true;
    previewMsg = '';
    const ok = await notifier.showVerseOfTheDay();
    previewing = false;
    previewMsg = ok ? 'Shown at the bottom right.' : 'Could not reach quran.com. Check your connection and try again.';
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
    getAutostart().then((on) => (autostart = on));
    pageFonts.ensure([1]); // the script previews draw page 1 in its own font
    if (isTauri()) version = await (await import('@tauri-apps/api/app')).getVersion();
    usedBytes = await offline.blobSizes();
  });

  // quiet "Saved" stamp whenever a setting changes
  $effect(() => {
    settings.snapshot();
    savedAt = Date.now();
    savedVisible = true;
    const t = setTimeout(() => (savedVisible = false), 1400);
    return () => clearTimeout(t);
  });

  const PAGE_TYPES: { id: PageType; name: string; hint: string }[] = [
    { id: 'madani', name: 'Madani', hint: 'Medina Mushaf, 15 lines, 604 pages. The standard print.' },
    { id: 'indopak', name: 'IndoPak', hint: 'South Asian print, 15 lines, 610 pages, with its own spelling.' }
  ];
  const LOOKS: { id: PageLook; name: string; hint: string }[] = [
    { id: 'paper', name: 'Paper', hint: 'A page on the desk.' },
    { id: 'frame', name: 'Frame', hint: 'Bordered like a printed page.' },
    { id: 'plain', name: 'Plain', hint: 'Just the text.' }
  ];
  const HIGHLIGHTS: { id: Highlight; name: string }[] = [
    { id: 'sweep', name: 'Sweep' },
    { id: 'fill', name: 'Glow' },
    { id: 'underline', name: 'Underline' }
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
  function setScript(id: Script) {
    settings.script = id;
    if (id === 'mushaf') settings.pageType = 'madani';
    if (id === 'indopak') settings.pageType = 'indopak';
  }
  function setPageType(id: PageType) {
    settings.pageType = id;
    if (id === 'indopak' && settings.script === 'mushaf') settings.script = 'indopak';
    if (id === 'madani' && settings.script === 'indopak') settings.script = 'mushaf';
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
  <div class="preview hl-{settings.highlight}" style:--ar-size="{Math.min(settings.size, 52)}px" style:--ar-lh={settings.spacing}>
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
    {#each GROUPS as g (g)}
      <h2 class="ngrp">{g}</h2>
      {#each AREAS.filter((a) => a.group === g) as a (a.id)}
        <button class:on={ui.area === a.id && !showChanged} onclick={() => { ui.area = a.id; showChanged = false; }} aria-current={ui.area === a.id && !showChanged ? 'page' : undefined}>
          <b>{a.name}</b><small>{a.hint}</small>
        </button>
      {/each}
    {/each}
  </nav>

  <div class="view">
    <header>
      <button class="back" onclick={() => ui.closeSettings()} aria-label="Back to reading" title="Back (Esc)">
        <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>
      </button>
      <h2>{query ? 'Search results' : showChanged ? 'Changed settings' : AREAS.find((a) => a.id === ui.area)?.name}</h2>
      <span class="saved" class:show={savedVisible} data-t={savedAt}>Saved</span>
      <button class="close" onclick={() => ui.closeSettings()} aria-label="Close settings">Done</button>
    </header>

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
      <div class="row wide">
        <div class="label"><h3>Theme</h3>{@render rst('Theme')}<p>Seven palettes, each tuned for comfortable contrast. Auto follows your system.</p></div>
        <div class="themes">
          <button class="theme auto" class:on={settings.theme === 'auto'} onclick={() => (settings.theme = 'auto')}>
            <span class="sw"><i style:background="#0e0c09"></i><i style:background="#ede8de"></i></span>
            <b>Auto</b>
          </button>
          {#each THEMES as t (t.id)}
            <button class="theme" class:on={settings.theme === t.id} onclick={() => (settings.theme = t.id)} aria-label="{t.name} theme">
              <span class="sw" style:background={t.bg}>
                <span class="ink" style:color={t.ink}>بسم</span>
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
      <h3 class="grp">Names</h3>
      <div class="row">
        <div class="label"><h3>Surah names in Arabic</h3>{@render rst('Surah names in Arabic')}<p>Show the Arabic name first in the list and player.</p></div>
        {@render toggle(settings.arabicNames, (v) => (settings.arabicNames = v), 'Arabic surah names')}
      </div>
    {/if}

    {#if browse && onPage('text')}
      {@render preview()}
      <h3 class="grp">Arabic script</h3>
      <div class="row wide">
        <div class="label"><h3>Script style</h3>{@render rst('Script style')}<p>How the Arabic is written. Madani Mushaf is the exact printed page; it is fetched once per page, then kept for offline use. Every card shows the same verse.</p></div>
        <div class="scripts">
          {#each SCRIPTS as sc (sc.id)}
            <button class="script" class:on={settings.script === sc.id} onclick={() => setScript(sc.id)} aria-pressed={settings.script === sc.id}>
              <span class="sample" class:tajweed={sc.id === 'tajweed'} dir="rtl" style:font-family={sc.id === 'mushaf' ? 'QCF1' : sc.family}>
                {#if sc.id === 'tajweed'}{@html sample('tajweed')}{:else}{sample(sc.id)}{/if}
              </span>
              <b>{sc.name}</b><small>{sc.hint}</small>
            </button>
          {/each}
        </div>
      </div>
      <p class="intro">Choosing <b>Madani Mushaf</b> or <b>IndoPak</b> also sets the matching page type under Mushaf pages, so the pages and the text agree.</p>
      <h3 class="grp">Size</h3>
      <div class="row">
        <div class="label"><h3>Text size</h3>{@render rst('Text size')}<p>{settings.size}px, for Verse by Verse. Mushaf pages always fill the page.</p></div>
        <input type="range" min="24" max="96" step="2" bind:value={settings.size} aria-label="Text size" />
      </div>
      <div class="row">
        <div class="label"><h3>Line spacing</h3>{@render rst('Line spacing')}<p>{settings.spacing.toFixed(1)}</p></div>
        <input type="range" min="1.3" max="3.2" step="0.1" bind:value={settings.spacing} aria-label="Line spacing" />
      </div>
    {/if}

    {#if browse && onPage('reading')}
      <h3 class="grp">Start</h3>
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
      <h3 class="grp">Translation</h3>
      <div class="row">
        <div class="label"><h3>Translation</h3>{@render rst('Translation')}<p>Shown under each verse and in Reading → Translation. Saved with the surah for offline use.</p></div>
        <TranslationPicker onpick={setTranslation} />
      </div>
      {#if settings.translation}
        <div class="row">
          <div class="label"><h3>Translation size</h3>{@render rst('Translation size')}<p>{settings.translationSize}px</p></div>
          <input type="range" min="13" max="30" step="1" bind:value={settings.translationSize} aria-label="Translation text size" />
        </div>
      {/if}
      <h3 class="grp">Word by word</h3>
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
    {/if}

    {#if browse && onPage('pages')}
      <p class="intro">These options are for <b>Reading</b> mode, the printed Mushaf pages. Verse by Verse ignores them.</p>
      <h3 class="grp">Page</h3>
      <div class="row">
        <div class="label"><h3>Page type</h3>{@render rst('Page type')}<p>Which printed Mushaf the pages follow. Same text, different line breaks and page numbers.</p></div>
        <div class="layouts">
          {#each PAGE_TYPES as l (l.id)}
            <button class="layout" class:on={settings.layout === l.id} onclick={() => setPageType(l.id)} aria-pressed={settings.layout === l.id}>
              <b>{l.name}</b><small>{l.hint}</small>
            </button>
          {/each}
        </div>
      </div>
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
      <h3 class="grp">On the page</h3>
      <div class="row">
        <div class="label"><h3>Page info</h3>{@render rst('Page info')}<p>Show the surah name, juz and page number on each page.</p></div>
        {@render toggle(settings.showPageInfo, (v) => (settings.showPageInfo = v), 'Page info')}
      </div>
      <div class="row">
        <div class="label"><h3>Highlight bookmarks</h3>{@render rst('Highlight bookmarks')}<p>Mark bookmarked verses with a filled verse-end ornament.</p></div>
        {@render toggle(settings.highlightBookmarks, (v) => (settings.highlightBookmarks = v), 'Highlight bookmarks')}
      </div>
    {/if}

    {#if browse && onPage('audio')}
      <h3 class="grp">Player</h3>
      <div class="row">
        <div class="label"><h3>Listening bar</h3>{@render rst('Listening bar')}<p>Reading comes first. The bar opens when you press Listen or play a verse, and ✕ closes it. Choose "Always" to keep it docked.</p></div>
        <div class="seg">
          <button class:on={settings.listenBar === 'demand'} onclick={() => (settings.listenBar = 'demand')}>On demand</button>
          <button class:on={settings.listenBar === 'always'} onclick={() => (settings.listenBar = 'always')}>Always</button>
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Show the bar only on hover</h3>{@render rst('Show the bar only on hover')}<p>Hides the bar until you move the mouse to the bottom edge of the window, and the page keeps all its room. It also appears for a moment when you start listening.</p></div>
        {@render toggle(settings.playerHover, (v) => (settings.playerHover = v), 'Show the player only on hover')}
      </div>
      <h3 class="grp">Recitation</h3>
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
        <div class="label"><h3>Repeat surah</h3>{@render rst('Repeat surah')}<p>Loop the current surah, handy for memorising.</p></div>
        {@render toggle(settings.repeatSurah, (v) => (settings.repeatSurah = v), 'Repeat surah')}
      </div>
      <div class="row">
        <div class="label"><h3>Say a word when clicked</h3>{@render rst('Say a word when clicked')}<p>Clicking a word plays just that word, with no menu. Needs a connection unless the surah is downloaded.</p></div>
        {@render toggle(settings.wordAudio, (v) => (settings.wordAudio = v), 'Word audio')}
      </div>
      <h3 class="grp">Following along</h3>
      <div class="row">
        <div class="label"><h3>Highlight style</h3>{@render rst('Highlight style')}<p>How the recited word is marked.</p></div>
        <div class="seg">
          {#each HIGHLIGHTS as h (h.id)}
            <button class:on={settings.highlight === h.id} onclick={() => (settings.highlight = h.id)}>{h.name}</button>
          {/each}
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Follow the recitation</h3>{@render rst('Follow the recitation')}<p>Scroll automatically so the current verse stays in view. Scrolling yourself pauses it for a moment.</p></div>
        {@render toggle(settings.autoScroll, (v) => (settings.autoScroll = v), 'Auto-scroll')}
      </div>
      <div class="row">
        <div class="label"><h3>Lock on the playing verse</h3>{@render rst('Lock on the playing verse')}<p>In the scrolling views, scrolling away only lasts a moment: once you let go, the view returns to the verse being recited, with all of it on screen (or the lines being recited, if the verse is taller than the window). Also on the lock button in the bar above the text.</p></div>
        {@render toggle(settings.lockPlaying, (v) => (settings.lockPlaying = v), 'Lock on the playing verse')}
      </div>
    {/if}

    {#if browse && onPage('manager')}
      <h3 class="grp">Audio downloads</h3>
      <div class="row mgr">
        <div class="label"><h3>Audio manager</h3><p>First choose a reciter, then download or delete the surahs you want. Each reciter's recitations are stored separately.</p></div>
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
    {/if}

    {#if browse && onPage('reminders')}
      <div class="row">
        <div class="label"><h3>Verse of the day</h3>{@render rst('Verse of the day')}<p>One verse from quran.com each day, from the time you choose: a card in the app, or a notification when the window is behind other apps or in the tray.</p></div>
        {@render toggle(settings.dailyVerse, (v) => (settings.dailyVerse = v), 'Verse of the day')}
      </div>
      {#if settings.dailyVerse}
        <div class="row">
          <div class="label"><h3>Show it from</h3>{@render rst('Show it from')}<p>It appears at this time while the app is running (in the tray too), or the first time you open the app after it.</p></div>
          <input class="time" type="time" bind:value={settings.dailyVerseTime} aria-label="Verse of the day time" />
        </div>
        <div class="row">
          <div class="label"><h3>Preview today's verse</h3><p>Shows the card now, without waiting.</p></div>
          <div class="stack">
            <button class="secondary" onclick={previewVerse} disabled={previewing}>{previewing ? 'Loading…' : 'Show now'}</button>
            {#if previewMsg}<small class="status" role="status">{previewMsg}</small>{/if}
          </div>
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
      <div class="row">
        <div class="label"><h3>Try it</h3><p>Sends a test reminder with your message.</p></div>
        <button class="secondary" onclick={() => notifier.test()}>Send a test</button>
      </div>
    {/if}

    {#if browse && onPage('focus')}
      <h3 class="grp">Window</h3>
      {#if FOCUS_MODE}
      <div class="row">
        <div class="label"><h3>Focus mode</h3><p>Hides the surah list and controls and goes full screen. Move the mouse to bring the player back. Press Esc to leave.</p></div>
        <button class="primary" onclick={() => ui.toggleFocus()}>{ui.focus ? 'Leave focus mode' : 'Enter focus mode'}</button>
      </div>
      {/if}
      <div class="row">
        <div class="label"><h3>Full screen</h3><p>Use the whole display without changing the layout.</p></div>
        <button class="secondary" onclick={() => ui.toggleFullscreen()}>{ui.fullscreen ? 'Exit full screen' : 'Enter full screen'}</button>
      </div>
      <div class="row">
        <div class="label"><h3>Keep the screen on</h3>{@render rst('Keep the screen on')}<p>Stop the display sleeping while a recitation plays.</p></div>
        {@render toggle(settings.keepAwake, (v) => (settings.keepAwake = v), 'Keep screen on')}
      </div>
      {#if FOCUS_MODE}
      <div class="row">
        <div class="label"><h3>Quiet in focus mode</h3><p>Update prompts stay hidden while you are in focus mode. For notifications from other apps, switch on Do Not Disturb in Windows (Focus) or macOS (Focus); apps are not allowed to change that for you.</p></div>
        <span class="note">Built in</span>
      </div>
      {/if}
      {#if isTauri()}
        <h3 class="grp">Background</h3>
        <div class="row">
          <div class="label"><h3>Keep running in the tray</h3>{@render rst('Keep running in the tray')}<p>Closing the window leaves Quran in the system tray, so reminders and the verse of the day still arrive. Click the tray icon to open it again, or right-click it to quit. Off: closing the window quits.</p></div>
          {@render toggle(settings.background, (v) => (settings.background = v), 'Keep running in the tray')}
        </div>
        <div class="row">
          <div class="label"><h3>Start with the computer</h3><p>Starts quietly in the tray when you sign in, without opening a window.</p></div>
          {@render toggle(autostart, toggleAutostart, 'Start with the computer')}
        </div>
      {/if}
    {/if}

    {#if browse && onPage('shortcuts')}
      <h3 class="grp">Keyboard shortcuts</h3>
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
          {#if FOCUS_MODE}<dt>Z</dt><dd>Focus mode</dd>{/if}
          <dt>F</dt><dd>Full screen</dd>
          <dt>,</dt><dd>Settings</dd>
          <dt>Esc</dt><dd>Close a menu or leave Settings</dd>
        </dl>
      </div>
    {/if}

    {#if browse && onPage('updates')}
      <h3 class="grp">Updates</h3>
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
            <div class="notes"><b>Version {updater.version}</b>{#if updater.notes}<p>{updater.notes}</p>{/if}</div>
          {/if}
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Update automatically</h3>{@render rst('Update automatically')}<p>New versions download quietly in the background. You only restart to finish.</p></div>
        {@render toggle(settings.checkUpdates, (v) => (settings.checkUpdates = v), 'Update automatically')}
      </div>
    {/if}

    {#if browse && onPage('data')}
      <h3 class="grp">Your data</h3>
      <div class="row">
        <div class="label"><h3>Offline downloads</h3><p>{mb(usedBytes)} MB of audio stored on this device. Download or delete recitations under Listening → Audio downloads.</p></div>
        <button class="secondary" onclick={() => (ui.area = 'audio')}>Open audio downloads…</button>
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
    {/if}

    {#if browse && onPage('about')}
      <h3 class="grp">The app</h3>
      <div class="row about">
        <div class="label"><h3>About</h3></div>
        <div>
          <p>Free and open source, with no ads and nothing locked. This is a beta: please report anything that looks wrong. Built on the ideas of
            <a href="https://github.com/quran/quran_android" target="_blank" rel="noreferrer">Quran for Android</a>.
            Text, timings and audio come from the Quran.com public API.</p>
          <p><a href="https://qurandesktop.netlify.app" target="_blank" rel="noreferrer">Website</a> ·
            <a href="https://github.com/Obscyra/quran-desktop" target="_blank" rel="noreferrer">Source code</a> ·
            <a href="https://github.com/Obscyra/quran-desktop/issues" target="_blank" rel="noreferrer">Report a problem</a></p>
        </div>
      </div>
      <div class="row about">
        <div class="label"><h3>Developer</h3><p>Made and maintained by one person.</p></div>
        <div class="dev">
          <b>Fahim Shahriar</b>
          <p>Email: <a href="mailto:fahimonlinux@gmail.com">fahimonlinux@gmail.com</a></p>
          <p>GitHub: <a href="https://github.com/Obscyra" target="_blank" rel="noreferrer">github.com/Obscyra</a></p>
          <p>Website: <a href="https://qurandesktop.netlify.app" target="_blank" rel="noreferrer">qurandesktop.netlify.app</a></p>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .settings { flex: 1; display: flex; min-width: 0; background: var(--bg); overflow: hidden; }
  nav { width: 264px; overflow-y: auto; flex: none; padding: 28px 14px; display: flex; flex-direction: column; gap: 2px; background: var(--bg-2); }
  .ngrp { font-size: 11px; font-weight: 650; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); padding: 16px 12px 6px; }
  .find { position: relative; display: block; margin: 0 4px 10px; }
  .find svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--ink-dim); pointer-events: none; }
  .find input { width: 100%; height: 36px; padding: 0 12px 0 33px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font: inherit; font-size: 13.5px; }
  .find input::placeholder { color: var(--ink-dim); }
  .find input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .results { list-style: none; margin: 0; padding: 0; display: grid; }
  nav .chg { flex-direction: row; width: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 2px 4px 0; padding: 8px 12px; border-radius: 10px; font-size: 13px; color: var(--ink-dim); border: 1px dashed var(--line); text-align: left; }
  nav .chg b { min-width: 20px; padding: 1px 7px; border-radius: 99px; text-align: center; font-size: 12px; font-weight: 600; background: var(--accent-soft); color: var(--accent); }
  nav .chg:hover { color: var(--ink); }
  nav .chg.on { color: var(--ink); border-style: solid; border-color: var(--accent); background: var(--accent-soft); }
  .results.changed li { display: flex; align-items: center; gap: 8px; }
  .results.changed .go { flex: 1; }
  .results.changed .again, .reset { flex: none; width: auto; display: inline-block; padding: 3px 10px; border-radius: 8px; font-size: 12px; color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); }
  .results.changed .again:hover, .reset:hover { background: var(--accent-soft); }
  .label { position: relative; }
  .reset { position: absolute; top: -1px; right: 0; }
  .results li + li { border-top: 1px solid var(--line); }
  .results button { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; width: 100%; padding: 14px 8px; text-align: left; border-radius: 8px; }
  .results button:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); }
  .results b { font-weight: 550; font-size: 14.5px; }
  .results small { color: var(--ink-dim); font-size: 12.5px; }
  .results .none { padding: 18px 8px; color: var(--ink-dim); font-size: 14px; }
  .row.flash { animation: flash 1.8s var(--ease); border-radius: 10px; }
  @keyframes flash { 0%, 55% { background: var(--accent-soft); box-shadow: 0 0 0 10px var(--accent-soft); } 100% { background: transparent; box-shadow: 0 0 0 10px transparent; } }
  .grp { font-size: 12px; font-weight: 650; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); padding: 26px 0 0; }
  .grp + .row { border-top: 0; }
  nav h1 { font-size: 18px; font-weight: 600; padding: 4px 12px 14px; }
  nav button { text-align: left; padding: 8px 12px; border-radius: 8px; display: flex; flex-direction: column; gap: 2px; transition: background 0.2s; }
  nav button:hover { background: color-mix(in srgb, var(--ink) 7%, transparent); }
  nav button.on { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  nav small { color: var(--ink-dim); font-size: 12px; }
  .view { flex: 1; min-width: 0; overflow-y: auto; padding: 0 clamp(24px, 5vw, 72px) 60px; }
  header { display: flex; align-items: center; gap: 14px; position: sticky; top: 0; background: var(--bg); padding: 28px 0 18px; z-index: 2; }
  header h2 { font-size: 24px; font-weight: 600; flex: 1; }
  .back { width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; color: var(--ink-dim); margin-left: -8px; }
  .back:hover { background: color-mix(in srgb, var(--ink) 9%, transparent); color: var(--ink); }
  .saved { color: var(--accent); font-size: 13px; opacity: 0; transition: opacity 0.4s; }
  .saved.show { opacity: 1; }
  .close { padding: 8px 18px; border-radius: 8px; background: var(--accent); color: var(--accent-ink); font-weight: 550; }

  .row { display: grid; grid-template-columns: minmax(200px, 340px) 1fr; gap: 28px; padding: 22px 0; align-items: start; }
  .row + .row { border-top: 1px solid var(--line); }
  /* big pickers (themes, scripts, page types, shortcuts) get the full width under their label */
  .row.wide { grid-template-columns: 1fr; gap: 16px; }
  .row.wide .label p { max-width: 62ch; }
  .view { container-type: inline-size; }
  /* on a narrower page every row stacks: label above its control */
  @container (max-width: 760px) {
    .row { grid-template-columns: 1fr; gap: 12px; padding: 18px 0; }
    .label p { max-width: 60ch; }
  }
  .label h3 { font-size: 15px; font-weight: 550; }
  .label p { margin-top: 4px; color: var(--ink-dim); font-size: 13.5px; line-height: 1.5; max-width: 38ch; }
  .times { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .tm { display: inline-flex; align-items: center; gap: 2px; }
  .time, .text { background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; font: inherit; color-scheme: inherit; }
  .text { min-width: 280px; max-width: 100%; user-select: text; }
  .rm { width: 26px; height: 26px; border-radius: 6px; display: grid; place-items: center; color: var(--ink-dim); }
  .rm:hover { background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink); }
  .rp-wrap { justify-self: start; max-width: 100%; }
  .row > :global(.toggle), .row > .times, .row > .time, .row > .text, .row > :global(.tp-btn), .row > .seg, .row > button.primary, .row > button.secondary, .row > .note { justify-self: start; }

  .dev b { font-size: 16px; }
  .dev p { margin-top: 4px; }
  .intro { margin: 0 0 4px; padding: 10px 14px; border-radius: 10px; background: var(--accent-soft); font-size: 13.5px; line-height: 1.55; color: var(--ink); }
  .preview { background: var(--surface); border-radius: 16px; padding: 22px 28px; margin-bottom: 8px; text-align: center; }
  .preview p { font-family: var(--ar-font); font-size: var(--ar-size); line-height: var(--ar-lh); color: var(--ink); }
  .preview small { color: var(--ink-dim); }

  .themes { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 12px; }
  .theme { display: flex; flex-direction: column; gap: 8px; padding: 8px; border-radius: 14px; text-align: left; transition: background 0.2s; outline: 2px solid transparent; }
  .theme:hover { background: var(--accent-soft); }
  .theme.on { outline-color: var(--accent); }
  .theme .sw { height: 62px; border-radius: 9px; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 18%, transparent); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; overflow: hidden; }
  .theme .sw .ink { font-family: 'Amiri Quran', serif; font-size: 22px; }
  .theme .sw i { width: 14px; height: 14px; border-radius: 50%; }
  .theme.auto .sw { padding: 0; border: 1px solid color-mix(in srgb, var(--ink) 28%, transparent); }
  .theme.auto .sw i { flex: 1; height: 100%; border-radius: 0; width: auto; }
  .theme b { font-size: 13px; font-weight: 500; padding: 0 2px; }

  .fonts { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
  .font { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 10px; border-radius: 14px; background: var(--surface); outline: 2px solid transparent; }
  .font small { font-family: var(--ui); color: var(--ink-dim); font-size: 12px; }
  .font.on { outline-color: var(--accent); }

  .layouts { display: grid; gap: 10px; }
  .layout { display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 14px 16px; border-radius: 14px; background: var(--surface); outline: 2px solid transparent; }
  .layout small { color: var(--ink-dim); font-size: 13px; }
  .layout.on { outline-color: var(--accent); }

  .seg { display: inline-flex; background: var(--surface); border-radius: 12px; padding: 3px; gap: 2px; flex-wrap: wrap; }
  .seg button { padding: 8px 14px; border-radius: 9px; color: var(--ink-dim); transition: background-color 0.2s, color 0.2s; }
  .seg button:hover { color: var(--ink); }
  .seg .custom { display: inline-flex; align-items: center; gap: 2px; padding: 0 10px; border-radius: 9px; color: var(--ink-dim); }
  .seg .custom.on { background: var(--accent-soft); color: var(--accent); }
  .seg .custom input { width: 74px; background: transparent; border: 0; color: inherit; font: inherit; text-align: right; outline: none; }
  .seg .custom input:focus-visible { box-shadow: 0 1px 0 var(--accent); }
  .seg button.on { background: var(--accent); color: var(--accent-ink); font-weight: 550; }

  input[type='range'] { width: min(100%, 360px); accent-color: var(--accent); height: 28px; }

  .toggle { width: 42px; height: 24px; border-radius: 999px; background: var(--line); position: relative; transition: background 0.25s; flex: none; }
  .toggle i { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--ink); transition: transform 0.25s var(--ease); }
  .toggle.on { background: var(--accent); }
  .toggle.on i { transform: translateX(18px); background: var(--accent-ink); }

  .primary, .secondary, .danger { padding: 9px 16px; border-radius: 8px; font-weight: 550; transition: border-color 0.2s, opacity 0.2s; }
  .primary { background: var(--accent); color: var(--accent-ink); }
  .secondary { border: 1px solid var(--ink-faint); color: var(--ink); }
  .secondary:hover:not(:disabled) { border-color: var(--ink-dim); }
  .secondary:disabled { opacity: 0.5; }
  .danger { border: 1px solid #c0392b; color: color-mix(in srgb, #c0392b 62%, var(--ink)); }
  .prog { width: min(360px, 100%); height: 6px; border-radius: 6px; background: color-mix(in srgb, var(--ink) 14%, transparent); overflow: hidden; }
  .prog i { display: block; height: 100%; background: var(--accent); transition: width 0.3s var(--ease); }
  .dls { list-style: none; padding: 0; border-top: 1px solid var(--line); }
  .dls li { display: grid; grid-template-columns: 34px 1fr auto 104px; gap: 12px; align-items: center; padding: 9px 4px; border-bottom: 1px solid var(--line); }
  .dls .num { color: var(--ink-dim); font-size: 12.5px; text-align: center; font-variant-numeric: tabular-nums; }
  .dls .nm { display: flex; flex-direction: column; min-width: 0; }
  .dls .nm b { font-weight: 550; font-size: 14px; }
  .dls .nm small, .dls .sz { color: var(--ink-dim); font-size: 12px; }
  .dls .sm { height: 28px; padding: 0 12px; font-size: 12.5px; justify-self: end; display: inline-grid; place-items: center; }
  .dls .wait { color: var(--ink-dim); display: inline-flex; align-items: center; gap: 8px; }
  .dls .wait b { font-weight: 600; min-width: 3ch; text-align: right; font-variant-numeric: tabular-nums; color: var(--ink); }
  .dls .dlbar { width: 44px; height: 5px; border-radius: 5px; background: color-mix(in srgb, var(--ink) 14%, transparent); overflow: hidden; }
  .dls .dlbar i { display: block; height: 100%; background: var(--accent); transition: width 0.25s linear; }
  .dls .auto { color: var(--accent); }
  .dls .none { display: block; padding: 28px; text-align: center; color: var(--ink-dim); }
  .dlhead { border-top: 0 !important; padding-bottom: 10px; }
  .stack .inline button { white-space: nowrap; }
  .mgr { margin-top: 18px; border-top: 1px solid var(--line) !important; }
  .notes { max-width: 52ch; padding: 12px 14px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); font-size: 13px; line-height: 1.55; }
  .notes p { margin-top: 6px; color: var(--ink-dim); white-space: pre-wrap; user-select: text; }
  .stack { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .status { color: var(--ink-dim); }
  .note { color: var(--ink-dim); font-size: 13px; padding: 8px 0; }
  .keys { display: grid; grid-template-columns: auto 1fr; gap: 8px 18px; font-size: 13.5px; }
  .keys dt { font-weight: 600; text-align: right; color: var(--accent); }
  .keys dd { color: var(--ink-dim); margin: 0; }
  .about p { color: var(--ink-dim); line-height: 1.6; max-width: 56ch; margin-bottom: 10px; }
  .about a { color: var(--accent); }
  .beta { display: inline-block; margin-left: 6px; padding: 0 7px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .inline { display: flex; gap: 10px; }
  .file { cursor: default; display: inline-block; }
  .preview .sample { font-size: var(--ar-size); line-height: var(--ar-lh); }
  .scripts { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .script { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 16px 12px 14px; border-radius: 14px; background: var(--surface); outline: 2px solid transparent; text-align: center; transition: outline-color 0.2s; }
  .script:hover { outline-color: var(--accent-soft); }
  .script.on { outline-color: var(--accent); }
  .script .sample { font-size: 22px; line-height: 1.8; color: var(--ink); max-width: 100%; min-height: 3.6em; display: flex; align-items: center; justify-content: center; text-align: center; text-wrap: balance; }
  .script b { font-size: 13.5px; font-weight: 600; margin-top: 4px; }
  .script small { color: var(--ink-dim); font-size: 12px; line-height: 1.4; }
  .looks { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .look { display: flex; flex-direction: column; gap: 3px; padding: 12px; border-radius: 14px; background: color-mix(in srgb, var(--ink) 5%, transparent); outline: 2px solid transparent; text-align: left; }
  .look.on { outline-color: var(--accent); }
  .look small { color: var(--ink-dim); font-size: 12px; }
  .mini { height: 74px; border-radius: 4px; display: flex; flex-direction: column; justify-content: center; gap: 5px; padding: 0 16px; margin-bottom: 8px; position: relative; }
  .mini i { height: 3px; border-radius: 2px; background: var(--ink-dim); opacity: 0.7; }
  .mini.paper { background: var(--surface); box-shadow: 0 8px 14px -8px #000a; }
  .mini.frame { background: var(--surface); outline: 1px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: -4px; box-shadow: inset 0 0 0 6px var(--surface), inset 0 0 0 8px color-mix(in srgb, var(--accent) 35%, transparent); }
  .mini.plain { background: transparent; border: 1px dashed var(--line); }
  .script :global([class^='tj-']) { color: inherit; }
  .script :global(.tj-ham_wasl), .script :global(.tj-laam_shamsiyah), .preview :global(.tj-ham_wasl), .preview :global(.tj-laam_shamsiyah) { color: var(--ink-faint); }
  .script :global(.tj-madda_normal), .preview :global(.tj-madda_normal) { color: #e0803a; }
  .script :global(.tj-madda_permissible), .preview :global(.tj-madda_permissible) { color: #e0a23a; }
</style>
