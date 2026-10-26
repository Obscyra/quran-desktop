<script lang="ts">
  import ReciterPicker from './ReciterPicker.svelte';
  import TranslationPicker from './TranslationPicker.svelte';
  import { onMount } from 'svelte';
  import { bookmarks } from '$lib/bookmarks.svelte';
  import { pageFonts } from '$lib/fonts.svelte';
  import * as offline from '$lib/offline';
  import { player } from '$lib/player.svelte';
  import { isTauri } from '$lib/platform';
  import { SCRIPTS, settings, type Highlight, type PageLook, type PageType, type Script, type WordMeaning } from '$lib/settings.svelte';
  import { THEMES } from '$lib/themes';
  import { translations } from '$lib/translations.svelte';
  import { confirm } from '$lib/confirm.svelte';
  import { notifier } from '$lib/notifications.svelte';
  import { ui, type SettingsArea } from '$lib/ui.svelte';
  import { updater } from '$lib/updater.svelte';

  const AREAS: { id: SettingsArea; name: string; hint: string; group: string }[] = [
    { id: 'appearance', name: 'Appearance', hint: 'Theme and interface size', group: 'Look' },
    { id: 'text', name: 'Arabic text', hint: 'Script style, size, spacing', group: 'Look' },
    { id: 'reading', name: 'Reading', hint: 'Start view, translation, meanings', group: 'Read' },
    { id: 'pages', name: 'Mushaf pages', hint: 'Page type, look, spread', group: 'Read' },
    { id: 'audio', name: 'Listening', hint: 'Player, reciter, follow along', group: 'Listen' },
    { id: 'manager', name: 'Audio manager', hint: 'Download or delete recitations', group: 'Listen' },
    { id: 'reminders', name: 'Reminders', hint: 'Notifications, verse of the day', group: 'App' },
    { id: 'focus', name: 'Focus & screen', hint: 'Distraction-free reading', group: 'App' },
    { id: 'shortcuts', name: 'Shortcuts', hint: 'Keyboard commands', group: 'App' },
    { id: 'updates', name: 'Updates', hint: 'Version and releases', group: 'App' },
    { id: 'data', name: 'Data & about', hint: 'Storage, bookmarks, reset, credits', group: 'App' }
  ];
  const UI_SIZES = [0.9, 1, 1.15, 1.3, 1.5];
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

  onMount(async () => {
    translations.load();
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

  // the first verse of Al-Fatihah, in every script, for the previews
  const SAMPLE = [
    { glyph: 'ﱁ', text: 'بِسۡمِ', taj: 'بِسۡمِ', indo: 'بِسۡمِ' },
    { glyph: 'ﱂ', text: 'ٱللَّهِ', taj: '<span class="tj-ham_wasl">ٱ</span>للَّهِ', indo: 'اللهِ' },
    { glyph: 'ﱃ', text: 'ٱلرَّحۡمَـٰنِ', taj: '<span class="tj-ham_wasl">ٱ</span><span class="tj-laam_shamsiyah">ل</span>رَّحۡمَ<span class="tj-madda_normal">ـٰ</span>نِ', indo: 'الرَّحۡمٰنِ' },
    { glyph: 'ﱄ', text: 'ٱلرَّحِيمِ', taj: '<span class="tj-ham_wasl">ٱ</span><span class="tj-laam_shamsiyah">ل</span>رَّح<span class="tj-madda_permissible">ِي</span>مِ', indo: 'الرَّحِيۡمِ' }
  ];
  const sample = (id: Script) =>
    id === 'mushaf' ? SAMPLE.map((w) => w.glyph).join(' ') : id === 'tajweed' ? SAMPLE.map((w) => w.taj).join(' ') : id === 'indopak' ? SAMPLE.map((w) => w.indo).join(' ') : SAMPLE.map((w) => w.text).join(' ');

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

{#snippet toggle(on: boolean, set: (v: boolean) => void, label: string)}
  <button class="toggle" class:on role="switch" aria-checked={on} aria-label={label} onclick={() => set(!on)}><i></i></button>
{/snippet}

<section class="settings">
  <nav aria-label="Settings areas">
    <h1>Settings</h1>
    {#each GROUPS as g (g)}
      <h2 class="ngrp">{g}</h2>
      {#each AREAS.filter((a) => a.group === g) as a (a.id)}
        <button class:on={ui.area === a.id} onclick={() => (ui.area = a.id)} aria-current={ui.area === a.id ? 'page' : undefined}>
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
      <h2>{AREAS.find((a) => a.id === ui.area)?.name}</h2>
      <span class="saved" class:show={savedVisible} data-t={savedAt}>Saved</span>
      <button class="close" onclick={() => ui.closeSettings()} aria-label="Close settings">Done</button>
    </header>

    {#if ui.area === 'appearance'}
      <div class="row wide">
        <div class="label"><h3>Theme</h3><p>Seven palettes, each tuned for comfortable contrast. Auto follows your system.</p></div>
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
        <div class="label"><h3>Interface size</h3><p>Makes the menus, lists, buttons and every other piece of interface text bigger or smaller. Currently {Math.round(settings.uiScale * 100)}%. The Arabic text has its own size under Arabic text.</p></div>
        <div class="seg" role="radiogroup" aria-label="Interface size">
          {#each UI_SIZES as u (u)}
            <button role="radio" aria-checked={settings.uiScale === u} class:on={settings.uiScale === u} onclick={() => (settings.uiScale = u)}>{u === 1 ? 'Default' : `${Math.round(u * 100)}%`}</button>
          {/each}
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Surah names in Arabic</h3><p>Show the Arabic name first in the list and player.</p></div>
        {@render toggle(settings.arabicNames, (v) => (settings.arabicNames = v), 'Arabic surah names')}
      </div>
    {/if}

    {#if ui.area === 'text'}
      {@render preview()}
      <div class="row wide">
        <div class="label"><h3>Script style</h3><p>How the Arabic is written. Madani Mushaf is the exact printed page; it is fetched once per page, then kept for offline use. Every card shows the same verse.</p></div>
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
      <div class="row">
        <div class="label"><h3>Text size</h3><p>{settings.size}px, for Verse by Verse. Mushaf pages always fill the page.</p></div>
        <input type="range" min="24" max="96" step="2" bind:value={settings.size} aria-label="Text size" />
      </div>
      <div class="row">
        <div class="label"><h3>Line spacing</h3><p>{settings.spacing.toFixed(1)}</p></div>
        <input type="range" min="1.3" max="3.2" step="0.1" bind:value={settings.spacing} aria-label="Line spacing" />
      </div>
    {/if}

    {#if ui.area === 'reading'}
      <div class="row">
        <div class="label"><h3>Open in</h3><p>What you see first. Switch any time from the top bar.</p></div>
        <div class="seg">
          <button class:on={settings.mode === 'reading'} onclick={() => (settings.mode = 'reading')}>Reading</button>
          <button class:on={settings.mode === 'verse'} onclick={() => (settings.mode = 'verse')}>Verse by Verse</button>
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Translation</h3><p>Shown under each verse and in Reading → Translation. Saved with the surah for offline use.</p></div>
        <TranslationPicker onpick={setTranslation} />
      </div>
      {#if settings.translation}
        <div class="row">
          <div class="label"><h3>Translation size</h3><p>{settings.translationSize}px</p></div>
          <input type="range" min="13" max="30" step="1" bind:value={settings.translationSize} aria-label="Translation text size" />
        </div>
      {/if}
      <div class="row">
        <div class="label"><h3>Word meanings</h3><p>Word-by-word translation in Verse by Verse. Right-click any word to see its meaning and play options.</p></div>
        <div class="seg">
          {#each MEANINGS as m (m.id)}
            <button class:on={settings.wordMeaning === m.id} onclick={() => (settings.wordMeaning = m.id)}>{m.name}</button>
          {/each}
        </div>
      </div>
      {#if settings.wordMeaning === 'below'}
        <div class="row wide">
          <div class="label"><h3>Transliteration</h3><p>Show how each word is pronounced, in Latin letters.</p></div>
          {@render toggle(settings.transliteration, (v) => (settings.transliteration = v), 'Transliteration')}
        </div>
      {/if}
    {/if}

    {#if ui.area === 'pages'}
      <div class="row">
        <div class="label"><h3>Page type</h3><p>Which printed Mushaf the pages follow. Same text, different line breaks and page numbers.</p></div>
        <div class="layouts">
          {#each PAGE_TYPES as l (l.id)}
            <button class="layout" class:on={settings.layout === l.id} onclick={() => setPageType(l.id)} aria-pressed={settings.layout === l.id}>
              <b>{l.name}</b><small>{l.hint}</small>
            </button>
          {/each}
        </div>
      </div>
      <div class="row wide">
        <div class="label"><h3>Page look</h3><p>The paper the Mushaf page is drawn on.</p></div>
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
        <div class="label"><h3>Page flow</h3><p>Turn one page at a time, or scroll the pages like a long sheet.</p></div>
        <div class="seg">
          <button class:on={settings.flow === 'page'} onclick={() => (settings.flow = 'page')}>Pages</button>
          <button class:on={settings.flow === 'scroll'} onclick={() => (settings.flow = 'scroll')}>Scroll</button>
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Two-page spread</h3><p>Show facing pages like an open book: odd pages on the right, even on the left. Needs a wide window. Press T.</p></div>
        {@render toggle(settings.spread, (v) => (settings.spread = v), 'Two-page spread')}
      </div>
      <div class="row">
        <div class="label"><h3>Page info</h3><p>Show the surah name, juz and page number on each page.</p></div>
        {@render toggle(settings.showPageInfo, (v) => (settings.showPageInfo = v), 'Page info')}
      </div>
      <div class="row">
        <div class="label"><h3>Highlight bookmarks</h3><p>Mark bookmarked verses with a filled verse-end ornament.</p></div>
        {@render toggle(settings.highlightBookmarks, (v) => (settings.highlightBookmarks = v), 'Highlight bookmarks')}
      </div>
    {/if}

    {#if ui.area === 'audio'}
      <h3 class="grp">Player</h3>
      <div class="row">
        <div class="label"><h3>Listening bar</h3><p>Reading comes first. The bar opens when you press Listen or play a verse, and ✕ closes it. Choose "Always" to keep it docked.</p></div>
        <div class="seg">
          <button class:on={settings.listenBar === 'demand'} onclick={() => (settings.listenBar = 'demand')}>On demand</button>
          <button class:on={settings.listenBar === 'always'} onclick={() => (settings.listenBar = 'always')}>Always</button>
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Reciter</h3><p>Switching keeps your place in the surah.</p></div>
        <div class="rp-wrap"><ReciterPicker /></div>
      </div>
      <div class="row">
        <div class="label"><h3>Playback speed</h3><p>Pitch is preserved.</p></div>
        <div class="seg">
          {#each SPEEDS as sp (sp)}
            <button class:on={settings.speed === sp} onclick={() => { settings.speed = sp; player.applySpeed(); }}>{sp}×</button>
          {/each}
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Play the next surah</h3><p>Continue automatically when a surah ends.</p></div>
        {@render toggle(settings.autoAdvance, (v) => (settings.autoAdvance = v), 'Auto-advance')}
      </div>
      <div class="row">
        <div class="label"><h3>Repeat surah</h3><p>Loop the current surah, handy for memorising.</p></div>
        {@render toggle(settings.repeatSurah, (v) => (settings.repeatSurah = v), 'Repeat surah')}
      </div>
      <h3 class="grp">Following along</h3>
      <div class="row">
        <div class="label"><h3>Highlight style</h3><p>How the recited word is marked.</p></div>
        <div class="seg">
          {#each HIGHLIGHTS as h (h.id)}
            <button class:on={settings.highlight === h.id} onclick={() => (settings.highlight = h.id)}>{h.name}</button>
          {/each}
        </div>
      </div>
      <div class="row">
        <div class="label"><h3>Follow the recitation</h3><p>Scroll automatically so the current verse stays in view. Scrolling yourself pauses it for a moment.</p></div>
        {@render toggle(settings.autoScroll, (v) => (settings.autoScroll = v), 'Auto-scroll')}
      </div>
      <div class="row">
        <div class="label"><h3>Say a word when clicked</h3><p>Clicking a word plays just that word, with no menu. Needs a connection unless the surah is downloaded.</p></div>
        {@render toggle(settings.wordAudio, (v) => (settings.wordAudio = v), 'Word audio')}
      </div>
    {/if}

    {#if ui.area === 'manager'}
      <div class="row mgr">
        <div class="label"><h3>Audio manager</h3><p>First choose a reciter, then download or delete the surahs you want. Each reciter's recitations are stored separately.</p></div>
        <div class="rp-wrap"><ReciterPicker value={dlReciter} onpick={(id) => (dlReciter = id)} /></div>
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
            <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax={player.dl.total} aria-valuenow={player.dl.done} aria-label="Download progress"><i style:width="{player.dl.total ? (player.dl.done / player.dl.total) * 100 : 0}%"></i></div>
            <small class="status" role="status">
              {#if player.dl.running}Downloading {player.dl.done} of {player.dl.total}…{:else if player.dl.failed}Finished, but {player.dl.failed} could not be downloaded. Run Download all again to retry.{:else}All done.{/if}
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
          <li>
            <span class="num">{c.id}</span>
            <span class="nm"><b>{c.name_simple}</b><small>{c.translated_name.name} · {c.verses_count} verses</small></span>
            <span class="sz">{got ? `${mb(sizes.get(`${dlReciter}:${c.id}`) ?? 0)} MB` : ''}</span>
            {#if got}
              <button class="secondary sm" onclick={() => deleteOne(c.id, c.name_simple)} aria-label="Delete {c.name_simple}">Delete</button>
            {:else if busy || one}
              <span class="sm wait">Downloading…</span>
            {:else}
              <button class="secondary sm" onclick={() => player.downloadMany(dlReciter, [c.id])} disabled={player.dl.running} aria-label="Download {c.name_simple}">Download</button>
            {/if}
          </li>
        {:else}
          <li class="none">Nothing downloaded for {dlName} yet.</li>
        {/each}
      </ul>
    {/if}

    {#if ui.area === 'reminders'}
      <div class="row">
        <div class="label"><h3>Verse of the day</h3><p>One verse from quran.com each day, shown here when you are in the app, from the time you choose.</p></div>
        {@render toggle(settings.dailyVerse, (v) => (settings.dailyVerse = v), 'Verse of the day')}
      </div>
      {#if settings.dailyVerse}
        <div class="row">
          <div class="label"><h3>Show it from</h3><p>It appears the first time you open the app after this time.</p></div>
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
        <div class="label"><h3>Reading reminders</h3><p>A nudge at the times below, as long as the app is running.</p></div>
        {@render toggle(settings.remindersOn, (v) => (settings.remindersOn = v), 'Reading reminders')}
      </div>
      {#if settings.remindersOn}
        <div class="row">
          <div class="label"><h3>Times</h3><p>Every day. Add as many as you like.</p></div>
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
          <div class="label"><h3>Message</h3><p>What the reminder says.</p></div>
          <input class="text" type="text" maxlength="120" bind:value={settings.remindMessage} aria-label="Reminder message" />
        </div>
      {/if}
      <div class="row">
        <div class="label"><h3>Use system notifications</h3><p>When the window is behind other apps, notify through Windows or macOS as well. Do Not Disturb and Focus still apply.</p></div>
        {@render toggle(settings.systemNotify, (v) => (settings.systemNotify = v), 'System notifications')}
      </div>
      <div class="row">
        <div class="label"><h3>Try it</h3><p>Sends a test reminder with your message.</p></div>
        <button class="secondary" onclick={() => notifier.test()}>Send a test</button>
      </div>
    {/if}

    {#if ui.area === 'focus'}
      <div class="row">
        <div class="label"><h3>Focus mode</h3><p>Hides the surah list and controls and goes full screen. Move the mouse to bring the player back. Press Esc to leave.</p></div>
        <button class="primary" onclick={() => ui.toggleFocus()}>{ui.focus ? 'Leave focus mode' : 'Enter focus mode'}</button>
      </div>
      <div class="row">
        <div class="label"><h3>Full screen</h3><p>Use the whole display without changing the layout.</p></div>
        <button class="secondary" onclick={() => ui.toggleFullscreen()}>{ui.fullscreen ? 'Exit full screen' : 'Enter full screen'}</button>
      </div>
      <div class="row">
        <div class="label"><h3>Keep the screen on</h3><p>Stop the display sleeping while a recitation plays.</p></div>
        {@render toggle(settings.keepAwake, (v) => (settings.keepAwake = v), 'Keep screen on')}
      </div>
      <div class="row">
        <div class="label"><h3>Quiet in focus mode</h3><p>Update prompts stay hidden while you are in focus mode. For notifications from other apps, switch on Do Not Disturb in Windows (Focus) or macOS (Focus); apps are not allowed to change that for you.</p></div>
        <span class="note">Built in</span>
      </div>
    {/if}

    {#if ui.area === 'shortcuts'}
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
          <dt>Z</dt><dd>Focus mode</dd>
          <dt>F</dt><dd>Full screen</dd>
          <dt>,</dt><dd>Settings</dd>
          <dt>Esc</dt><dd>Close a menu, leave focus or close settings</dd>
        </dl>
      </div>
    {/if}

    {#if ui.area === 'updates'}
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
        <div class="label"><h3>Update automatically</h3><p>New versions download quietly in the background. You only restart to finish.</p></div>
        {@render toggle(settings.checkUpdates, (v) => (settings.checkUpdates = v), 'Update automatically')}
      </div>
    {/if}

    {#if ui.area === 'data'}
      <div class="row">
        <div class="label"><h3>Offline downloads</h3><p>{mb(usedBytes)} MB of audio stored on this device. Download or delete recitations in Audio manager.</p></div>
        <button class="secondary" onclick={() => (ui.area = 'manager')}>Open audio manager…</button>
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
      <div class="row about">
        <div class="label"><h3>About</h3></div>
        <div>
          <p>Free and open source, with no ads and nothing locked. This is a beta: please report anything that looks wrong. Built on the ideas of
            <a href="https://github.com/quran/quran_android" target="_blank" rel="noreferrer">Quran for Android</a>.
            Text, timings and audio come from the Quran.com public API.</p>
          <p><a href="https://github.com/Obscyra/quran-desktop" target="_blank" rel="noreferrer">Source code</a></p>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .settings { flex: 1; display: flex; min-width: 0; background: var(--bg); overflow: hidden; }
  nav { width: 264px; overflow-y: auto; flex: none; padding: 28px 14px; display: flex; flex-direction: column; gap: 2px; background: var(--bg-2); }
  .ngrp { font-size: 11px; font-weight: 650; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); padding: 16px 12px 6px; }
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
  .dls .wait { color: var(--ink-dim); }
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
  .script .sample { font-size: 26px; line-height: 1.9; color: var(--ink); white-space: nowrap; }
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
