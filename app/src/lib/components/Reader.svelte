<script lang="ts">
  import { untrack } from 'svelte';
  import { copyVerse, toggleBookmark } from '$lib/actions';
  import { bookmarks } from '$lib/bookmarks.svelte';
  import { player } from '$lib/player.svelte';
  import { reader } from '$lib/reader.svelte';
  import { settings, type WordMeaning } from '$lib/settings.svelte';
  import { translations } from '$lib/translations.svelte';
  import { ui } from '$lib/ui.svelte';
  import End from './End.svelte';
  import PageSheet from './PageSheet.svelte';
  import TranslationPicker from './TranslationPicker.svelte';
  import Word from './Word.svelte';

  const reading = $derived(settings.mode === 'reading');
  const mushafMode = $derived(reading && settings.readingStyle === 'arabic');
  const paged = $derived(mushafMode && settings.flow === 'page');
  const scrolling = $derived(!paged);
  const activeVerse = $derived(player.activeTiming?.verse ?? 0);
  const below = $derived(settings.wordMeaning === 'below' && !reading);
  const lastIdx = $derived(reader.pages.length - 1);

  let scroller = $state<HTMLElement>();
  let lastUserScroll = 0;

  // each surah opens on its first page
  $effect(() => {
    player.chapter;
    reader.pageIdx = 0;
    scroller?.scrollTo({ top: 0 });
  });
  $effect(() => {
    translations.load();
  });

  // the page turns when the recitation does
  $effect(() => {
    if (!paged || !reader.activeKey) return;
    const i = reader.wordPage.get(reader.activeKey);
    // untracked: browsing to another page yourself must not re-trigger this and snap you back
    if (i !== undefined) untrack(() => reader.show(i));
  });

  // remember where the reader is, so the app reopens there
  $effect(() => {
    if (!paged) return;
    const first = reader.page?.lines[0]?.cells[0]?.verse.n;
    if (first) player.remember(first);
  });

  // bookmark, search result or reopen: take the reader to a verse
  $effect(() => {
    const j = player.jump;
    if (!j || !player.verses.length) return;
    untrack(() => {
      if (paged) {
        const i = reader.wordPage.get(`${j.verse}-1`);
        if (i !== undefined) reader.show(i);
      } else {
        const id = mushafMode ? `w-${j.verse}-1` : reading ? `t-${j.verse}` : `v-${j.verse}`;
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'center' }));
      }
      player.jump = null;
    });
  });

  // keep the recited verse in view, but never fight a reader who is scrolling
  $effect(() => {
    if (paged || !activeVerse || !scroller || !settings.autoScroll) return;
    if (Date.now() - lastUserScroll < 2500) return;
    const el = document.getElementById(mushafMode ? `w-${reader.activeKey}` : reading ? `t-${activeVerse}` : `v-${activeVerse}`);
    if (!el) return;
    const box = scroller.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < box.top + box.height * 0.15 || r.bottom > box.top + box.height * 0.7) {
      scroller.scrollTo({ top: scroller.scrollTop + (r.top - box.top - box.height * 0.3) / settings.uiScale, behavior: 'smooth' });
    }
  });

  // wheel / trackpad turns pages, one per gesture
  let lastTurn = 0;
  function wheel(e: WheelEvent) {
    if (!paged || Math.abs(e.deltaY) < 12) return;
    e.preventDefault();
    const now = Date.now();
    if (now - lastTurn < 520) return;
    lastTurn = now;
    reader.go(e.deltaY > 0 ? 1 : -1);
  }
  let touchX = 0;
  const touchStart = (e: TouchEvent) => (touchX = e.touches[0].clientX);
  function touchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 60) reader.go(dx > 0 ? 1 : -1); // swipe right = forward (right to left reading)
  }

  const MEANINGS: { id: WordMeaning; name: string }[] = [
    { id: 'off', name: 'Off' },
    { id: 'hover', name: 'Hover' },
    { id: 'below', name: 'Below' }
  ];
  function setTranslation(id: number) {
    settings.translation = id;
    // picking a translation while meanings are switched off means the reader wants to see it
    if (id && settings.wordMeaning === 'off') settings.wordMeaning = 'hover';
    player.refreshText();
  }
  const surahName = $derived(settings.arabicNames ? player.current?.name_arabic : player.current?.name_simple);
</script>

<div
  class="reader"
  style:--ar-size="{settings.size}px"
  style:--ar-lh={settings.spacing}
  style:--tr-size="{settings.translationSize}px"
>
  <!-- ───────── controls for the way you are reading ───────── -->
  <div class="sub" class:away={ui.focus && !ui.chromeVisible} inert={ui.focus && !ui.chromeVisible}>
    {#if reading}
      <div class="seg" role="radiogroup" aria-label="Reading style">
        <button role="radio" aria-checked={settings.readingStyle === 'arabic'} onclick={() => (settings.readingStyle = 'arabic')}>Arabic</button>
        <button role="radio" aria-checked={settings.readingStyle === 'translation'} onclick={() => (settings.readingStyle = 'translation')}>Translation</button>
      </div>
      {#if mushafMode}
        <div class="seg" role="radiogroup" aria-label="Page flow">
          <button role="radio" aria-checked={settings.flow === 'page'} onclick={() => (settings.flow = 'page')}>Pages</button>
          <button role="radio" aria-checked={settings.flow === 'scroll'} onclick={() => (settings.flow = 'scroll')}>Scroll</button>
        </div>
        {#if settings.flow === 'page'}
          <button class="icon" class:on={settings.spread} aria-pressed={settings.spread} aria-label="Two-page spread (T)" title="Two-page spread (T)" onclick={() => (settings.spread = !settings.spread)}>
            <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M10 5.2C8.4 4.2 5.6 3.8 2.8 4.4v10.8c2.8-.6 5.6-.2 7.2.8 1.6-1 4.4-1.4 7.2-.8V4.4c-2.8-.6-5.6-.2-7.2.8zM10 5.2V16" /></svg>
          </button>
        {/if}
      {:else}
        <label class="pick"><span>Translation</span><TranslationPicker compact onpick={setTranslation} /></label>
      {/if}
    {:else}
      <label class="pick"><span>Translation</span><TranslationPicker compact onpick={setTranslation} /></label>
      <div class="seg" role="radiogroup" aria-label="Word meanings">
        {#each MEANINGS as m (m.id)}
          <button role="radio" aria-checked={settings.wordMeaning === m.id} onclick={() => (settings.wordMeaning = m.id)}>{m.name === 'Below' ? 'Word by word' : m.name === 'Hover' ? 'Meanings on hover' : 'No meanings'}</button>
        {/each}
      </div>
      <div class="size" role="group" aria-label="Arabic text size">
        <button class="icon" aria-label="Zoom out" title="Zoom out" disabled={settings.size <= 24} onclick={() => (settings.size = Math.max(24, settings.size - 4))}>
          <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m12.7 12.7 4 4M6 8.5h5" /></svg>
        </button>
        <button class="icon" aria-label="Zoom in" title="Zoom in" disabled={settings.size >= 96} onclick={() => (settings.size = Math.min(96, settings.size + 4))}>
          <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m12.7 12.7 4 4M6 8.5h5M8.5 6v5" /></svg>
        </button>
      </div>
    {/if}
    <span class="grow"></span>
    {#if paged && reader.page}
      <span class="where">Page {reader.page.page} · Juz {reader.page.juz}</span>
    {/if}
  </div>

  {#if player.error}
    <div class="msg">
      <p>{player.error}</p>
      <button class="retry" onclick={() => player.load(player.chapter, false)}>Try again</button>
    </div>
  {:else if player.loading && !player.verses.length}
    <p class="msg">Loading…</p>
  {:else if paged && reader.page}
    <!-- ───────── Mushaf pages ───────── -->
    <div class="stage hl-{settings.highlight}" onwheel={wheel} ontouchstart={touchStart} ontouchend={touchEnd} role="presentation">
      <!-- Arabic books open from the right: the next page is on the left -->
      <button class="turn next" onclick={() => reader.go(1)} disabled={!reader.canForward} aria-label="Next page (Page Down)">
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>
      </button>

      {#if settings.spread}
        {#key reader.spread.rightNo}
          <div class="book spread" class:fwd={reader.dir > 0} class:back={reader.dir < 0}>
            <PageSheet page={reader.spread.left} no={reader.spread.leftNo} side="left" last={reader.spread.left?.page === reader.pages[lastIdx]?.page} />
            <PageSheet page={reader.spread.right} no={reader.spread.rightNo} side="right" last={reader.spread.right?.page === reader.pages[lastIdx]?.page} />
          </div>
        {/key}
      {:else}
        {#key reader.pageIdx}
          <div class="book" class:fwd={reader.dir > 0} class:back={reader.dir < 0}>
            <PageSheet page={reader.page} last={reader.pageIdx === lastIdx} />
          </div>
        {/key}
      {/if}

      <button class="turn prev" onclick={() => reader.go(-1)} disabled={!reader.canBack} aria-label="Previous page (Page Up)">
        <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>
      </button>
    </div>
  {:else}
    <main class="scroll" bind:this={scroller} onwheel={() => (lastUserScroll = Date.now())} ontouchmove={() => (lastUserScroll = Date.now())}>
      {#if player.current}
        <div class="head">
          <p class="kicker">{player.current.revelation_place} · {player.current.verses_count} verses</p>
          <h2>{player.current.name_arabic}</h2>
          <p class="sub2">{surahName} — {player.current.translated_name.name}</p>
          <div class="head-actions">
            <button class="listen" onclick={() => player.toggle()}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>Listen
            </button>
          </div>
        </div>
      {/if}

      {#if player.current?.bismillah_pre}
        <p class="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</p>
      {/if}

      {#if mushafMode}
        <!-- scroll: the printed pages one after another -->
        <div class="pages hl-{settings.highlight}">
          {#each reader.pages as pg, i (pg.page)}
            <div class="pg"><PageSheet page={pg} last={i === lastIdx} /></div>
          {/each}
        </div>
      {:else if reading}
        <!-- reading, translation only -->
        <article class="tflow">
          {#if !settings.translation}
            <p class="hint">Choose a translation above to read it here.</p>
          {/if}
          {#each player.verses as v (v.n)}
            <p id="t-{v.n}" class:now={activeVerse === v.n || ui.pick?.verse === v.n && ui.pick.pos === 0}>
              <button class="vn" class:saved={settings.highlightBookmarks && bookmarks.has(player.chapter, v.n)} onclick={() => (ui.pick = { chapter: player.chapter, verse: v.n, pos: 0 })} id="end-{v.n}" aria-label="Verse {v.n} options">{v.n}</button>
              {v.translation ?? ''}
            </p>
          {/each}
        </article>
      {:else}
        <!-- verse by verse -->
        <div class="verses hl-{settings.highlight}">
          {#each player.verses as v (v.n)}
            {@const saved = bookmarks.has(player.chapter, v.n)}
            <section class="verse" id="v-{v.n}" class:now={activeVerse === v.n || (ui.pick?.verse === v.n)}>
              <div class="tools">
                <span class="ref">{player.chapter}:{v.n}</span>
                <button class="icon" onclick={() => player.playVerse(v.n)} aria-label="Play verse {v.n}" title="Play this verse">
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
                </button>
                <button class="icon" class:on={saved} onclick={() => toggleBookmark(v.n)} aria-pressed={saved} aria-label={saved ? 'Remove bookmark' : 'Bookmark verse'} title={saved ? 'Remove bookmark' : 'Bookmark'}>
                  <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M5.5 2.8h9v14.4L10 13.6l-4.5 3.6z" /></svg>
                </button>
                <button class="icon" onclick={() => copyVerse(v.n)} aria-label="Copy verse" title="Copy verse">
                  <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="7" y="7" width="9.5" height="9.5" rx="2" /><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></svg>
                </button>
              </div>
              <div class="ar" class:below dir="rtl">
                {#each v.words as w (w.pos)}
                  <Word {v} {w} {below} />{' '}
                {/each}<End {v} />
              </div>
              {#if settings.translation && v.translation && settings.wordMeaning !== 'off'}
                <p class="tr" dir="auto">{v.translation}</p>
              {/if}
            </section>
          {/each}
        </div>
      {/if}
      <div class="tail"></div>
    </main>
  {/if}
</div>

<style>
  .reader { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; font-family: var(--ui); }
  .msg { margin: auto; color: var(--ink-dim); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .retry { height: 34px; padding: 0 18px; border-radius: 999px; border: 1px solid var(--ink-faint); color: var(--ink); font-weight: 550; font-size: 13px; transition: border-color 0.15s; }
  .retry:hover { border-color: var(--accent); }

  /* ───── sub bar ───── */
  .sub { flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 16px; min-height: 46px; border-bottom: 1px solid var(--line); overflow-x: auto; scrollbar-width: none; }
  /* in focus mode the title bar floats over the page, so the controls float just beneath it and leave together */
  :global(.app.focus) .sub { position: fixed; top: 40px; left: 0; right: 0; z-index: 29; background: var(--bg-2); transition: transform 0.4s var(--ease), opacity 0.3s var(--ease); }
  :global(.app.focus) .sub.away { transform: translateY(-140%); opacity: 0; pointer-events: none; }
  .grow { flex: 1; }
  .where { color: var(--ink-dim); font-size: 12.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .seg { display: inline-flex; background: color-mix(in srgb, var(--ink) 8%, transparent); border-radius: 8px; padding: 2px; flex: none; }
  .seg button { padding: 0 12px; height: 26px; border-radius: 6px; font-size: 12.5px; font-weight: 550; color: var(--ink-dim); white-space: nowrap; transition: background-color 0.2s, color 0.2s; }
  .seg button:hover { color: var(--ink); }
  .seg button[aria-checked='true'] { background: var(--bg); color: var(--ink); box-shadow: 0 1px 2px #0003; }
  .icon { min-width: 30px; height: 28px; padding: 0 6px; border-radius: 7px; display: inline-grid; place-items: center; color: var(--ink-dim); font-size: 12.5px; font-weight: 600; transition: background-color 0.15s, color 0.15s; }
  .icon:hover { background: color-mix(in srgb, var(--ink) 9%, transparent); color: var(--ink); }
  .icon.on { color: var(--accent); }
  .icon:disabled { opacity: 0.35; }
  .size { display: inline-flex; }
  .pick { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink-dim); flex: none; }

  /* ───── page stage ───── */
  .stage { flex: 1; min-height: 0; position: relative; display: grid; place-items: center; container-type: size; padding: 0 12px; }
  .book { --sh: min(calc(100cqh - 24px), calc((100cqw - 140px) / 0.66)); animation: turn-fwd 0.34s var(--ease); display: flex; }
  .book.spread { --sh: min(calc(100cqh - 24px), calc((100cqw - 140px) / 1.32)); }
  .book.back { animation-name: turn-back; }
  @keyframes turn-fwd { from { opacity: 0; transform: translateX(-28px); } }
  @keyframes turn-back { from { opacity: 0; transform: translateX(28px); } }
  .turn { position: absolute; top: 50%; translate: 0 -50%; width: 44px; height: 88px; border-radius: 12px; display: grid; place-items: center; color: var(--ink-dim); transition: background-color 0.15s, color 0.15s, opacity 0.15s; z-index: 2; }
  .turn:hover:not(:disabled) { background: color-mix(in srgb, var(--ink) 8%, transparent); color: var(--ink); }
  .turn:disabled { opacity: 0.2; }
  .turn.next { left: 14px; }
  .turn.prev { right: 14px; }

  /* ───── scrolling views ───── */
  .scroll { flex: 1; overflow-y: auto; padding: 0 clamp(20px, 6vw, 96px); min-width: 0; container-type: inline-size; }
  .head { text-align: center; padding: 36px 0 16px; }
  .kicker { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-dim); }
  h2 { font-family: 'KFGQPC Uthmanic Hafs', serif; font-weight: 400; font-size: clamp(48px, 6vw, 80px); line-height: 1.6; margin: 4px 0 6px; color: var(--accent); }
  .sub2 { color: var(--ink-dim); }
  .head-actions { margin-top: 16px; display: flex; justify-content: center; gap: 10px; }
  .listen { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 18px; border-radius: 999px; background: var(--accent); color: var(--accent-ink); font-weight: 600; font-size: 13px; transition: transform 0.15s var(--ease), opacity 0.15s; }
  .listen:hover { opacity: 0.92; }
  .listen:active { transform: scale(0.97); }
  .bismillah { font-family: 'KFGQPC Uthmanic Hafs', serif; font-size: calc(var(--ar-size) * 0.95); text-align: center; color: var(--ink-dim); margin: 14px 0 10px; line-height: 2; }
  .tail { height: 120px; }

  .pages { display: flex; flex-direction: column; align-items: center; gap: 28px; padding-top: 8px; }
  .pg { --sh: calc(min(760px, 100cqw) / 0.66); }

  .verses { max-width: 900px; margin: 0 auto; }
  .verse { padding: 18px 14px 22px; border-radius: 14px; transition: background-color 0.3s; border-bottom: 1px solid var(--line); }
  .verse.now { background: color-mix(in srgb, var(--accent) 9%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
  .tools { display: flex; align-items: center; gap: 2px; margin-bottom: 6px; }
  .ref { font-size: 13px; color: var(--ink-dim); font-variant-numeric: tabular-nums; margin-right: 8px; min-width: 42px; }
  .ar { text-align: right; line-height: var(--ar-lh); }
  .ar.below { display: flex; flex-wrap: wrap; gap: 4px 18px; justify-content: flex-start; align-items: flex-start; }
  .tr { margin-top: 12px; font-size: var(--tr-size); line-height: 1.7; color: var(--ink-dim); max-width: 68ch; user-select: text; -webkit-user-select: text; }

  .tflow { max-width: 740px; margin: 0 auto; padding-top: 8px; }
  .tflow p { font-size: var(--tr-size); line-height: 1.85; padding: 8px 12px; border-radius: 10px; color: var(--ink); user-select: text; -webkit-user-select: text; transition: background-color 0.3s; }
  .tflow p.now { background: color-mix(in srgb, var(--accent) 8%, transparent); }
  .vn { display: inline-grid; place-items: center; min-width: 26px; height: 22px; padding: 0 6px; margin-right: 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; vertical-align: 1px; }
  .vn:hover { background: color-mix(in srgb, var(--accent) 28%, transparent); }
  .vn.saved { background: var(--accent); color: var(--accent-ink); }
  .hint { color: var(--ink-dim); text-align: center; padding: 30px 0; }
</style>
