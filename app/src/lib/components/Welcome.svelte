<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { pageFonts } from '$lib/fonts.svelte';
  import { player } from '$lib/player.svelte';
  import { sample } from '$lib/script-sample';
  import { SCRIPTS, settings, type Script, type WordMeaning } from '$lib/settings.svelte';
  import { THEMES } from '$lib/themes';
  import { translations } from '$lib/translations.svelte';
  import { ui } from '$lib/ui.svelte';

  const STEPS = ['Look', 'Reading', 'Language', 'Ready'] as const;
  let step = $state(0);
  let card = $state<HTMLElement>();

  const SIZES = [0.9, 1, 1.1, 1.3];
  const MEANINGS: { id: WordMeaning; name: string }[] = [
    { id: 'hover', name: 'On hover' },
    { id: 'below', name: 'Under each word' },
    { id: 'off', name: 'Off' }
  ];

  // the language of the chosen translation (0 is the Arabic alone)
  const language = $derived(settings.translation === 0 ? '' : (translations.list.find((t) => t.id === settings.translation)?.language ?? 'English'));
  const inLanguage = $derived(translations.list.filter((t) => t.language === language));
  const languages = $derived(translations.grouped.map(([l, list]) => ({ name: l, count: list.length })));
  let find = $state('');
  const shown = $derived.by(() => {
    const q = find.trim().toLowerCase();
    return q ? languages.filter((l) => l.name.toLowerCase().includes(q)) : languages;
  });
  /** the chosen language scrolls into view in its list (a language picked by default is not at the top) */
  function reveal(node: HTMLElement) {
    node.querySelector('.on')?.scrollIntoView({ block: 'center' });
  }

  function setTranslation(id: number) {
    settings.translation = id;
    player.refreshText();
  }
  function pickLanguage(l: string) {
    if (!l) return setTranslation(0);
    const options = translations.list.filter((t) => t.language === l);
    // English keeps the translation that comes with the app
    setTranslation((l === 'English' && options.find((t) => t.id === 20)?.id) || options[0]?.id || settings.translation);
  }

  function setScript(id: Script) {
    settings.script = id;
    if (id === 'mushaf') settings.pageType = 'madani';
    if (id === 'indopak') settings.pageType = 'indopak';
  }
  function finish() {
    try {
      localStorage.setItem('quran.welcomed', '1');
    } catch {
      /* it may show again next time */
    }
    ui.welcome = false;
  }
  const go = (n: number) => {
    step = Math.min(STEPS.length - 1, Math.max(0, n));
    tick().then(() => card?.querySelector<HTMLElement>('button.pri')?.focus());
  };

  onMount(() => {
    translations.load();
    pageFonts.ensure([1]); // the Madani Mushaf sample is page 1 in its own font
    card?.querySelector<HTMLElement>('button.pri')?.focus();
  });
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      finish();
    }
  }
</script>

<svelte:window onkeydowncapture={key} />

<div class="scrim" role="presentation">
  <div class="card" bind:this={card} role="dialog" aria-modal="true" aria-labelledby="w-t">
    <header>
      <ol aria-label="Setup progress">
        {#each STEPS as s, i (s)}<li class:on={i === step} class:done={i < step} aria-current={i === step ? 'step' : undefined}><span>{i + 1}</span>{s}</li>{/each}
      </ol>
      <button class="skip" onclick={finish}>Skip setup</button>
    </header>

    {#if step === 0}
      <h2 id="w-t">Welcome. Choose how it looks.</h2>
      <p class="sub">Everything here can be changed later in Settings, the gear at the top right.</p>
      <div class="themes" role="radiogroup" aria-label="Theme">
        <button class="th" role="radio" aria-checked={settings.theme === 'auto'} class:on={settings.theme === 'auto'} onclick={() => (settings.theme = 'auto')}>
          <span class="sw auto"><i style:background="#0e0c09"></i><i style:background="#ede8de"></i></span><b>Match system</b>
        </button>
        {#each THEMES as t (t.id)}
          <button class="th" role="radio" aria-checked={settings.theme === t.id} class:on={settings.theme === t.id} onclick={() => (settings.theme = t.id)}>
            <span class="sw" style:background={t.bg}><span class="ink" style:color={t.ink}>بسم</span><i style:background={t.accent}></i></span><b>{t.name}</b>
          </button>
        {/each}
      </div>
      <h3>Interface size</h3>
      <div class="row" role="radiogroup" aria-label="Interface size">
        {#each SIZES as u (u)}
          <button class="chip" role="radio" aria-checked={settings.uiScale === u} class:on={settings.uiScale === u} onclick={() => (settings.uiScale = u)}>{u === 1 ? 'Default' : `${Math.round(u * 100)}%`}</button>
        {/each}
      </div>
    {:else if step === 1}
      <h2 id="w-t">How do you like to read?</h2>
      <p class="sub">Start with a verse at a time with its meaning, or with the printed Mushaf page.</p>
      <div class="modes" role="radiogroup" aria-label="Reading mode">
        <button class="mode" role="radio" aria-checked={settings.mode === 'verse'} class:on={settings.mode === 'verse'} onclick={() => (settings.mode = 'verse')}>
          <b>Verse by Verse</b><span>Each verse with its translation and tools.</span>
        </button>
        <button class="mode" role="radio" aria-checked={settings.mode === 'reading'} class:on={settings.mode === 'reading'} onclick={() => (settings.mode = 'reading')}>
          <b>Reading</b><span>The pages as in the printed Mushaf.</span>
        </button>
      </div>
      <h3>Arabic style</h3>
      <div class="scripts" role="radiogroup" aria-label="Arabic style">
        {#each SCRIPTS as s (s.id)}
          <button class="sc" role="radio" aria-checked={settings.script === s.id} class:on={settings.script === s.id} onclick={() => setScript(s.id)}>
            <span class="ar" dir="rtl" lang="ar" style:font-family={s.id === 'mushaf' ? 'QCF1' : s.family}>
              {#if s.id === 'tajweed'}{@html sample('tajweed')}{:else}{sample(s.id)}{/if}
            </span>
            <b>{s.name}</b><small>{s.hint}</small>
          </button>
        {/each}
      </div>
    {:else if step === 2}
      <h2 id="w-t">Which language do you read in?</h2>
      <p class="sub">The translation under each verse, and the meaning shown for each word, follow this language.</p>
      {#if translations.list.length}
        <div class="duo">
          <section aria-label="Language">
            <h3>Language</h3>
            <div class="find">
              <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3.5 3.5" /></svg>
              <input bind:value={find} placeholder="Search {languages.length} languages" aria-label="Search languages" />
            </div>
            <div class="list" role="radiogroup" aria-label="Language" {@attach reveal}>
              {#if !find.trim()}
                <button class="lang" class:on={!language} role="radio" aria-checked={!language} onclick={() => pickLanguage('')}>
                  <span>Arabic only</span><small>no translation</small>
                </button>
              {/if}
              {#each shown as l (l.name)}
                <button class="lang" class:on={l.name === language} role="radio" aria-checked={l.name === language} onclick={() => pickLanguage(l.name)}>
                  <span>{l.name}</span><small>{l.count}</small>
                </button>
              {:else}
                <p class="empty">No language matches “{find}”</p>
              {/each}
            </div>
          </section>
          <section aria-label="Translation">
            <h3>Translation{language ? ` · ${language}` : ''}</h3>
            <div class="list tr" role="radiogroup" aria-label="Translation" {@attach reveal}>
              {#if language}
                {#each inLanguage as t (t.id)}
                  <button class="opt" class:on={t.id === settings.translation} role="radio" aria-checked={t.id === settings.translation} onclick={() => setTranslation(t.id)}>
                    <span class="who"><b>{t.name}</b>{#if t.author && t.author !== t.name}<small>{t.author}</small>{/if}</span>
                    <i class="dot" aria-hidden="true"></i>
                  </button>
                {/each}
              {:else}
                <p class="empty">Only the Arabic text is shown. Pick a language to read a translation under each verse.</p>
              {/if}
            </div>
          </section>
        </div>
      {:else}
        <p class="note">The list of translations needs an internet connection. English (Saheeh International) is set for now; you can choose another in Settings later.</p>
      {/if}
      <h3>Word-by-word meanings</h3>
      <div class="row" role="radiogroup" aria-label="Word meanings">
        {#each MEANINGS as m (m.id)}
          <button class="chip" role="radio" aria-checked={settings.wordMeaning === m.id} class:on={settings.wordMeaning === m.id} onclick={() => (settings.wordMeaning = m.id)}>{m.name}</button>
        {/each}
      </div>
    {:else}
      <h2 id="w-t">You are ready.</h2>
      <p class="sub">The whole Quran is inside the app, so you can read without a connection. Audio is downloaded when you need it.</p>
      <ul class="tips">
        <li>Press <kbd>B</kbd> for the list of surahs, or type a place like <kbd>55:13</kbd>.</li>
        <li>Click a word to hear it. Right-click a word or a verse for its meaning and more.</li>
        <li>Open <b>Settings</b> with the gear icon, or <kbd>,</kbd>, to change anything you chose here.</li>
      </ul>
    {/if}

    <footer>
      {#if step > 0}<button class="ghost" onclick={() => go(step - 1)}>Back</button>{:else}<span></span>{/if}
      {#if step < STEPS.length - 1}
        <button class="pri" onclick={() => go(step + 1)}>Next</button>
      {:else}
        <button class="pri" onclick={finish}>Start reading</button>
      {/if}
    </footer>
  </div>
</div>

<style>
  .scrim { position: fixed; inset: 0; z-index: 95; display: grid; place-items: center; background: #0009; animation: fade 0.25s; }
  @keyframes fade { from { opacity: 0; } }
  .card {
    width: min(940px, calc((100vw - 32px) / var(--zoom, 1))); max-height: calc((100vh - 32px) / var(--zoom, 1)); overflow: auto;
    min-height: min(720px, calc((100vh - 32px) / var(--zoom, 1))); display: flex; flex-direction: column;
    padding: 24px 32px 24px; border-radius: 18px; background: var(--panel); border: 1px solid var(--line);
    box-shadow: 0 28px 70px -18px #000d; animation: pop 0.3s var(--ease);
  }
  @keyframes pop { from { opacity: 0; transform: translateY(10px) scale(0.985); } }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
  ol { display: flex; gap: 14px; list-style: none; padding: 0; margin: 0; font-size: 12.5px; color: var(--ink-dim); }
  li { display: flex; align-items: center; gap: 6px; }
  li span { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--line); font-size: 11px; font-variant-numeric: tabular-nums; }
  li.on { color: var(--ink); font-weight: 600; }
  li.on span, li.done span { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  li.on span { box-shadow: 0 0 0 3px var(--accent-soft); }
  li:not(.on):not(.done) { opacity: 0.7; }
  .skip { color: var(--ink); font-size: 13px; padding: 6px 12px; border-radius: 8px; background: var(--btn); border: 1px solid var(--btn-line); }
  .skip:hover { background: var(--btn-hover); }
  h2 { font-size: 26px; font-weight: 650; letter-spacing: -0.01em; }
  .sub { margin-top: 6px; color: var(--ink-dim); font-size: 15px; line-height: 1.55; }
  h3 { margin: 20px 0 8px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); font-weight: 600; }
  .themes { display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; margin-top: 18px; }
  .th { display: flex; flex-direction: column; gap: 8px; padding: 8px; border-radius: 14px; text-align: left; background: var(--btn); }
  .th b { font-size: 13.5px; font-weight: 500; padding: 0 2px; }
  .sw { display: flex; align-items: center; justify-content: space-between; height: 76px; padding: 0 11px; border-radius: 9px; overflow: hidden; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 18%, transparent); }
  .sw .ink { font-family: 'Amiri Quran', serif; font-size: 26px; }
  .sw i { width: 16px; height: 16px; border-radius: 50%; }
  .sw.auto { padding: 0; }
  .sw.auto i { flex: 1; height: 100%; border-radius: 0; width: auto; }
  .th:hover, .chip:hover, .sc:hover, .mode:hover { background: var(--btn-hover); }
  .on:not(li) { background: var(--btn-on) !important; }
  .on:not(li) b { color: var(--accent); }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { padding: 9px 18px; border-radius: 10px; border: 1px solid var(--btn-line); background: var(--btn); font-size: 13.5px; font-weight: 550; transition: background-color 0.15s, border-color 0.15s; }
  .chip:hover { background: var(--btn-hover); }
  .modes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
  .mode { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; text-align: left; padding: 12px 16px; border-radius: 12px; background: var(--btn); }
  .mode b { font-size: 15px; }
  .mode span { color: var(--ink-dim); font-size: 12.5px; line-height: 1.4; }
  .scripts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .sc { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 8px 10px; border-radius: 14px; background: var(--btn); text-align: center; min-width: 0; }
  .sc .ar { font-size: 20px; line-height: 1.7; color: var(--ink); max-width: 100%; min-height: 2.8em; display: flex; align-items: center; justify-content: center; text-wrap: balance; }
  .sc b { font-size: 13.5px; font-weight: 600; margin-top: 2px; }
  .sc small { color: var(--ink-dim); font-size: 12px; line-height: 1.4; }
  .sc :global([class^='tj-']) { color: inherit; }
  .sc :global(.tj-ham_wasl), .sc :global(.tj-laam_shamsiyah) { color: var(--ink-faint); }
  .sc :global(.tj-madda_normal) { color: #e0803a; }
  .sc :global(.tj-madda_permissible) { color: #e0a23a; }
  .duo { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 16px; margin-top: 8px; }
  .duo h3 { margin: 12px 0 8px; }
  .find { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 12px; border-radius: 10px; background: var(--btn); border: 1px solid var(--btn-line); color: var(--ink-dim); transition: border-color 0.15s, box-shadow 0.15s; }
  .find:focus-within { background: var(--btn-hover); box-shadow: 0 0 0 3px var(--accent-soft); }
  .find input { flex: 1; min-width: 0; background: none; border: 0; outline: 0; color: var(--ink); font: inherit; font-size: 13.5px; user-select: text; -webkit-user-select: text; }
  .list { margin-top: 8px; height: 276px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding: 4px; border-radius: 14px; background: color-mix(in srgb, var(--ink) 4%, transparent); border: 1px solid var(--line); }
  .duo section:last-child .list { margin-top: 0; height: 322px; }
  .lang { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 14px; min-height: 40px; border-radius: 10px; text-align: left; font-size: 14px; border: 1px solid transparent; transition: background-color 0.15s, border-color 0.15s; flex: none; }
  .lang small { color: var(--ink-dim); font-size: 12px; font-variant-numeric: tabular-nums; }
  .lang:hover { background: var(--btn); }
  .lang.on { background: var(--btn-on); color: var(--accent); font-weight: 600; }
  .lang.on small { color: inherit; }
  .opt { display: flex; align-items: center; gap: 12px; padding: 10px 14px; min-height: 52px; border-radius: 10px; text-align: left; border: 1px solid transparent; transition: background-color 0.15s, border-color 0.15s; flex: none; }
  .opt:hover { background: var(--btn); }
  .who { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .who b { font-size: 14px; font-weight: 600; }
  .who small { font-size: 12.5px; color: var(--ink-dim); }
  .dot { flex: none; width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--btn-line); display: grid; place-items: center; transition: border-color 0.15s; }
  .opt.on { background: var(--btn-on); }
  .opt.on .dot { border-color: var(--accent); }
  .opt.on .dot::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: dot 0.25s var(--ease); }
  @keyframes dot { from { transform: scale(0); } }
  .empty { padding: 20px 14px; text-align: center; color: var(--ink-dim); font-size: 13px; line-height: 1.5; }
  .note { margin-top: 16px; padding: 12px 14px; border-radius: 10px; background: var(--accent-soft); font-size: 13.5px; line-height: 1.55; }
  .tips { margin: 16px 0 0; padding-left: 18px; display: grid; gap: 10px; font-size: 14px; line-height: 1.55; }
  kbd { padding: 1px 6px; border-radius: 5px; border: 1px solid var(--line); font: inherit; font-size: 12.5px; }
  footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 16px; position: sticky; bottom: -24px; padding-bottom: 24px; margin-bottom: -24px; background: linear-gradient(transparent, var(--panel) 18px); }
  .ghost { padding: 9px 18px; border-radius: 10px; color: var(--ink); background: var(--btn); border: 1px solid var(--btn-line); font-weight: 550; }
  .ghost:hover { background: var(--btn-hover); }
  .pri { padding: 10px 22px; border-radius: 10px; background: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .pri:hover { opacity: 0.92; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  @media (max-width: 1000px) { .themes { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 760px) { .duo { grid-template-columns: 1fr; } .themes { grid-template-columns: repeat(2, 1fr); } .scripts { grid-template-columns: repeat(2, 1fr); } .modes { grid-template-columns: 1fr; } }
</style>
