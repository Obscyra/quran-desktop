<script lang="ts">
  import Skeleton from './Skeleton.svelte';
  import { player } from '$lib/player.svelte';
  import { hints } from '$lib/hints.svelte';
  import { settings } from '$lib/settings.svelte';
  import { ui } from '$lib/ui.svelte';
  import ReciterPicker from './ReciterPicker.svelte';

  let volShow = $state(false);
  let volTimer = 0;
  let preMute = 1;
  function toggleMute() {
    if (settings.volume > 0) { preMute = settings.volume; settings.volume = 0; }
    else settings.volume = preMute || 1;
    player.applyVolume();
    volShow = true;
    clearTimeout(volTimer);
    volTimer = window.setTimeout(() => (volShow = false), 1200);
  }
  function wheelVol(e: WheelEvent) {
    e.preventDefault();
    const v = Math.min(1, Math.max(0, Math.round((settings.volume + (e.deltaY < 0 ? 0.05 : -0.05)) * 20) / 20));
    settings.volume = v;
    player.applyVolume();
    volShow = true;
    clearTimeout(volTimer);
    volTimer = window.setTimeout(() => (volShow = false), 1200);
  }

  const shown = $derived(ui.listening || settings.playerBar !== 'demand');

  // "Show on hover": the bar floats over the bottom edge of the page and slides up while the mouse is
  // there (or a control in it has the keyboard); it also shows for a moment when listening starts.
  const float = $derived(settings.playerBar !== 'always' && shown);
  let peek = $state(false);
  let over = false;
  let held = false;
  let speedOpen = $state(false);
  let peekTimer = 0;
  const open = $derived(shown && (!float || peek));
  function enter() {
    if (float && !peek) hints.note('barPeek');
    over = true;
    clearTimeout(peekTimer);
    peek = true;
  }
  function leave() {
    over = false;
    clearTimeout(peekTimer);
    if (!held && !speedOpen) peekTimer = window.setTimeout(() => (peek = false), 650);
  }
  // a mouse that leaves the window (or a window that loses focus) may never send mouseleave: close from here too
  function away() {
    over = false;
    held = false;
    speedOpen = false;
    clearTimeout(peekTimer);
    peekTimer = window.setTimeout(() => (peek = false), 350);
  }
  let bar = $state<HTMLElement>();
  // centre over the reading column, never over the sidebar: follow `.main` (CSS px inside the zoomed app)
  let mainL = $state(0);
  let mainW = $state<number | null>(null);
  $effect(() => {
    const main = document.querySelector<HTMLElement>('.main');
    if (!main) return;
    const sync = () => { mainL = main.offsetLeft; mainW = main.offsetWidth; };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(main);
    return () => ro.disconnect();
  });
  $effect(() => {
    ui.barOver = float && open;
    return () => (ui.barOver = false);
  });
  function track(e: PointerEvent) {
    if (!peek || !over || held || speedOpen || !bar) return;
    if (!bar.contains(e.target as Node)) leave();
  }
  function release() {
    held = false;
    if (!over && peek) leave();
  }
  $effect(() => {
    if (!(ui.listening && float)) return;
    peek = true;
    peekTimer = window.setTimeout(() => !over && !held && !speedOpen && (peek = false), 2600);
    return () => clearTimeout(peekTimer);
  });

  const fmt = (s: number) => {
    s = Math.max(0, Math.floor(s || 0));
    const two = (n: number) => String(n).padStart(2, '0');
    // a long surah runs past an hour: show hours too
    return s >= 3600 ? `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}` : `${Math.floor(s / 60)}:${two(s % 60)}`;
  };
  const playingVerse = $derived(player.activeTiming?.verse ?? 0);
  /** from any screen (Settings included): back to the surah and verse that is playing */
  function showPlaying() {
    ui.closeSettings();
    if (playingVerse) player.jump = { verse: playingVerse, n: Date.now() };
  }
  const frac = $derived(player.duration ? player.time / player.duration : 0);
  const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

  /** this surah is on its way (a single download or part of Download all) */
  const fetching = $derived(
    player.downloading === player.chapter || player.chapterProgress !== null || (player.dl.running && player.dl.reciter === player.reciterId && player.dl.current.includes(player.chapter))
  );
  const pct = $derived(player.chapterProgress !== null && player.chapterProgress >= 0 ? Math.round(player.chapterProgress * 100) : null);
  const R = 11;
  const CIRC = 2 * Math.PI * R;

  function seekKey(e: KeyboardEvent) {
    const step = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
    if (!step) return;
    e.preventDefault();
    e.stopPropagation(); // the page uses arrows for verse navigation
    player.seek(Math.max(0, (player.time + step) * 1000));
  }
  function scrub(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    player.seekFraction(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  }
  function closeSpeed() {
    if (!speedOpen) return;
    speedOpen = false;
    if (!over && peek) leave();
  }
  function pickSpeed(v: number) {
    settings.speed = v;
    player.applySpeed();
    closeSpeed();
    speedBtn?.focus();
  }
  let speedBtn = $state<HTMLElement>();
  let speedBox = $state<HTMLElement>();
  function speedKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSpeed(); speedBtn?.focus(); return; }
    const items = speedBox ? [...speedBox.querySelectorAll<HTMLElement>('[role=menuitemradio]')] : [];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (d && items.length) { e.preventDefault(); items[(i + d + items.length) % items.length].focus(); }
  }
  function toggleSpeed() {
    speedOpen = !speedOpen;
    if (!speedOpen) { if (!over && peek) leave(); return; }
    queueMicrotask(() => requestAnimationFrame(() => speedBox?.querySelector<HTMLElement>('[aria-checked=true]')?.focus()));
  }
  function outside(e: PointerEvent) {
    if (speedOpen && !speedBox?.contains(e.target as Node) && !speedBtn?.contains(e.target as Node)) closeSpeed();
  }
  $effect(() => { if (!open) speedOpen = false; });
</script>

<svelte:window onpointerup={release} onpointermove={track} onblur={away} onpointerdown={outside} />
<svelte:document onmouseleave={away} />

{#if float && !peek}<div class="zone" role="presentation" onmouseenter={enter} onpointerenter={enter}><i></i></div>{/if}

<footer
  class:float
  class:closed={!open}
  class:tight={mainW !== null && mainW < 790}
  class:slim={mainW !== null && mainW < 470}
  inert={!open}
  aria-label="Listening"
  onmouseenter={enter}
  onmouseleave={leave}
  bind:this={bar}
  style:--mL="{mainL}px"
  style:--mW={mainW === null ? null : mainW + 'px'}
  onfocusin={(e) => e.target instanceof HTMLElement && e.target.matches(':focus-visible') && enter()}
  onfocusout={leave}
  onpointerdown={() => (held = true)}
>
  <div class="now">
    <button class="np" onclick={showPlaying} title="Go to the verse being recited" aria-label="Now playing: {player.current?.name_simple ?? ''}{playingVerse ? ', verse ' + playingVerse : ''}. Go to it">
      <b>{settings.arabicNames ? (player.current?.name_arabic ?? '—') : (player.current?.name_simple ?? '—')}</b>
      {#if player.loadingAudio}<span class="vs load" role="status" aria-label="Loading the recitation"><Skeleton w="64px" h="10px" /></span>{:else if playingVerse}<span class="vs">Verse {playingVerse}<i>/ {player.current?.verses_count}</i></span>{/if}
      {#if player.loopVerse}<em>· repeating</em>{/if}
    </button>
    <ReciterPicker compact />
  </div>

  <div class="btns">
      <button class="ctl" onclick={() => player.prev()} aria-label="Previous surah" title="Previous surah">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" x2="5" y1="19" y2="5" /></svg>
      </button>
      <button class="ctl" onclick={() => player.stepVerse(-1)} disabled={!!player.audio?.plain} aria-label="Previous verse" title={player.audio?.plain ? 'This reciter plays whole surahs only' : 'Previous verse'}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <button class="play" onclick={() => player.toggle()} aria-label={player.loadingAudio ? 'Loading the recitation' : player.playing ? 'Pause' : 'Play'} aria-busy={player.loadingAudio}>
        {#if player.loadingAudio}
          <i class="wait" aria-hidden="true"></i>
        {:else if player.playing}
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></svg>
        {:else}
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3" /></svg>
        {/if}
      </button>
      <button class="ctl" onclick={() => player.stepVerse(1)} disabled={!!player.audio?.plain} aria-label="Next verse" title={player.audio?.plain ? 'This reciter plays whole surahs only' : 'Next verse'}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </button>
      <button class="ctl" onclick={() => player.next()} aria-label="Next surah" title="Next surah">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" x2="19" y1="5" y2="19" /></svg>
      </button>
  </div>
  <div class="scrub">
      <span>{fmt(player.time)}</span>
      <div class="bar" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(frac * 100)} aria-valuetext="{fmt(player.time)} of {fmt(player.duration)}" onclick={scrub} onkeydown={seekKey}>
        <i style:width="{frac * 100}%"></i>
        {#if player.loadingAudio}<span class="clip" aria-hidden="true"><b class="shimmer"></b></span>{/if}
      </div>
      <span>{fmt(player.duration)}</span>
  </div>

  <div class="tools">
    <button class="chip rep" class:on={settings.repeatSurah} onclick={() => (settings.repeatSurah = !settings.repeatSurah)} aria-pressed={settings.repeatSurah} title={settings.repeatSurah ? 'Repeating this surah. Click to stop' : 'Repeat this surah'} aria-label="Repeat this surah">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>
    </button>
    <div class="spdwrap">
      <button class="chip speed" bind:this={speedBtn} class:on={settings.speed !== 1} onclick={toggleSpeed} aria-haspopup="menu" aria-expanded={speedOpen} title="Playback speed" aria-label="Playback speed {settings.speed}×">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>
        <span class="spd">{settings.speed}×</span>
      </button>
      {#if speedOpen}
        <div class="spdmenu" role="menu" aria-label="Playback speed" tabindex="-1" bind:this={speedBox} onkeydown={speedKey}>
          {#each SPEEDS as v (v)}
            <button class="opt" role="menuitemradio" aria-checked={settings.speed === v} class:on={settings.speed === v} onclick={() => pickSpeed(v)}>{v}×</button>
          {/each}
        </div>
      {/if}
    </div>
    <div class="vol" role="group" aria-label="Volume" onwheel={wheelVol}>
      <button class="ctl" onclick={toggleMute} title={settings.volume === 0 ? 'Unmute (scroll to change volume)' : 'Mute (scroll to change volume)'} aria-label={settings.volume === 0 ? 'Unmute' : 'Mute'}><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />{#if settings.volume > 0}<path d="M16 9a5 5 0 0 1 0 6" />{/if}{#if settings.volume > 0.5}<path d="M19.364 18.364a9 9 0 0 0 0-12.728" />{/if}{#if settings.volume === 0}<line x1="22" x2="16" y1="9" y2="15" /><line x1="16" x2="22" y1="9" y2="15" />{/if}</svg></button>
      {#if volShow}<span class="pct" aria-live="polite">{Math.round(settings.volume * 100)}%</span>{/if}
    </div>
    {#if player.isDownloaded}
      <button class="dl done" onclick={() => player.removeDownload()} title="Saved for offline listening. Click to remove" aria-label="Saved offline. Remove the offline copy">
        <svg aria-hidden="true" viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="12" fill="currentColor" /><path d="m8.6 14.4 3.9 3.8 7-8" fill="none" stroke="var(--chrome)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    {:else if fetching}
      <button class="dl busy" disabled title={pct === null ? 'Downloading…' : `Downloading ${pct}%`} aria-label={pct === null ? 'Downloading' : `Downloading, ${pct} percent`}>
        <svg aria-hidden="true" viewBox="0 0 28 28" width="30" height="30" class:spin={pct === null}>
          <circle cx="14" cy="14" r={R} fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width="3" />
          <circle cx="14" cy="14" r={R} fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray={CIRC} stroke-dashoffset={pct === null ? CIRC * 0.72 : CIRC * (1 - pct / 100)} transform="rotate(-90 14 14)" />
        </svg>
        {#if pct !== null}<b>{pct}</b>{/if}
      </button>
    {:else}
      <button class="dl" onclick={() => player.download()} disabled={player.downloading !== null} title="Download for offline listening" aria-label="Download this surah for offline listening">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
      </button>
    {/if}
    {#if settings.playerBar === 'demand'}
      <button class="chip x" onclick={() => player.stop()} aria-label="Close player" title="Stop and close">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </button>
    {/if}
  </div>
</footer>

<style>
  /* the player is a capsule over the chrome surface; hover-mode and closed both sit over the bottom edge */
  footer {
    flex: none; align-self: center; width: min(calc(920px / var(--zoom, 1)), calc(var(--mW, 100%) - 32px)); margin: 0 0 16px var(--mL, 0px); box-sizing: border-box;
    display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(max-content, 1fr); align-items: center; gap: 8px 24px;
    padding: 8px 14px; min-height: 60px; background: var(--chrome); border: 1px solid var(--hair); border-radius: var(--r-lg); box-shadow: var(--e2);
    user-select: none; -webkit-user-select: none; z-index: 30;
    transition: transform 0.5s var(--ease), opacity 0.35s var(--ease);
    will-change: transform;
  }
  /* Closed, the bar leaves the layout at once (the page above it reflows one time) and slides out over the
     bottom edge. Animating its height instead made the page refit on every frame, which stuttered. */
  footer.float, footer.closed { position: absolute; bottom: 16px; margin: 0; transform: translateX(-50%); left: calc(var(--mL, 0px) + var(--mW, 100%) / 2); }
  footer.closed { transform: translate(-50%, calc(100% + 32px)); opacity: 0; pointer-events: none; }
  .zone { position: absolute; inset: auto 0 0 0; height: 44px; z-index: 29; display: flex; justify-content: center; align-items: flex-end; }
  .zone i { width: 64px; height: 4px; margin-bottom: 8px; border-radius: var(--r-sm); background: var(--muted); opacity: 0.45; pointer-events: none; }
  .now em { font-style: normal; font-weight: 400; color: var(--accent); }
  .chip.x { width: 40px; padding: 0; display: grid; place-items: center; }
  .dl { position: relative; flex: none; box-sizing: border-box; padding: 0; width: 40px; height: 40px; border-radius: var(--r-sm); display: grid; place-items: center; color: var(--muted); background: none; border: 0; transition: color 0.15s, background-color 0.15s; }
  .dl:hover:not(:disabled) { background: var(--ink-6); color: var(--ink); }
  .dl.done { color: var(--accent); }
  .play .wait { width: 20px; height: 20px; border-radius: 50%; border: 3px solid color-mix(in oklab, var(--accent-ink) 30%, transparent); border-top-color: var(--accent-ink); animation: spin 0.8s linear infinite; }
  .vs.load { color: var(--accent); }
  .bar .clip { position: absolute; inset: 0; overflow: hidden; border-radius: var(--r-pill); pointer-events: none; }
  .bar .shimmer { position: absolute; inset: 0; width: 35%; background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--accent) 70%, transparent), transparent); animation: slide 1.1s ease-in-out infinite; pointer-events: none; }
  @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(300%); } }
  .dl.busy { color: var(--accent); }
  .dl.busy b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 11px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
  .dl svg.spin { animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .now { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .np { display: flex; align-items: baseline; gap: 8px; text-align: left; border-radius: var(--r-sm); margin: 0 -4px; padding: 1px 4px; min-width: 0; }
  .np:hover { background: color-mix(in oklab, var(--ink) 8%, transparent); }
  .np b { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vs { font-size: 12.5px; color: var(--accent); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .vs i { font-style: normal; color: var(--muted); margin-left: 3px; }

  .btns { display: flex; align-items: center; justify-content: center; gap: 16px; }
  .ctl { width: 40px; height: 40px; border-radius: var(--r-sm); display: grid; place-items: center; color: var(--muted); background: transparent; border: 0; transition: background-color 0.15s, color 0.15s, transform 0.2s var(--ease); }
  .ctl:disabled { opacity: 0.35; pointer-events: auto; cursor: not-allowed; }
  .ctl:hover:not(:disabled) { background: var(--ink-6); color: var(--ink); }
  .ctl:active:not(:disabled) { transform: scale(0.92); }
  .play { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: var(--accent-ink); box-shadow: var(--e1); transition: transform 0.2s var(--ease), opacity 0.15s; }
  .play:hover:not(:disabled) { transform: scale(1.06); }
  .play:active:not(:disabled) { transform: scale(0.95); }
  .play:disabled { opacity: 0.4; }
  .scrub { grid-column: 1 / -1; grid-row: 2; display: flex; align-items: center; gap: 10px; width: 100%; font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .bar { flex: 1; height: 4px; background: var(--ink-6); border-radius: var(--r-pill); cursor: pointer; position: relative; transition: height 0.2s var(--ease); }
  .bar::before { content: ''; position: absolute; inset: -8px 0; }
  .bar:hover, .bar:focus-visible { height: 7px; }
  .bar i { display: block; position: relative; height: 100%; background: var(--accent); border-radius: var(--r-pill); pointer-events: none; transition: width 0.3s linear; }
  .bar i::after { content: ''; position: absolute; right: -6px; top: 50%; width: 12px; height: 12px; margin-top: -6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 30%, transparent); transform: scale(0); transition: transform 0.2s var(--ease); }
  .bar:hover i::after, .bar:focus-visible i::after { transform: scale(1); }

  .tools { display: flex; justify-content: flex-end; align-items: center; gap: 12px; min-width: max-content; }
  .chip { height: 40px; min-width: 40px; padding: 0 8px; border-radius: var(--r-sm); color: var(--muted); font-size: 12.5px; font-weight: 600; background: transparent; border: 0; transition: background-color 0.15s, color 0.15s; font-variant-numeric: tabular-nums; }
  .chip:hover:not(:disabled) { background: var(--ink-6); color: var(--ink); }
  .chip:disabled { opacity: 0.5; }
  .chip.rep { width: 40px; padding: 0; display: grid; place-items: center; }
  .chip.rep.on { background: var(--on-bg); color: var(--on-fg); box-shadow: var(--on-ring); }
  .chip.rep.on:hover:not(:disabled) { background: var(--on-bg-hover); color: var(--on-fg); }
  .spdwrap { position: relative; flex: none; }
  .chip.speed { flex: none; box-sizing: border-box; width: max-content; min-width: 40px; padding: 0 12px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; line-height: 1; }
  .chip.speed.on { background: var(--on-bg); color: var(--on-fg); box-shadow: var(--on-ring); }
  .chip.speed.on:hover:not(:disabled) { background: var(--on-bg-hover); }
  .chip.speed svg { flex: none; display: block; }
  .chip .spd { display: block; text-align: left; line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .spdmenu { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); z-index: 5; display: flex; flex-direction: column; gap: 2px; padding: 4px; min-width: 76px; background: var(--chrome); border: 1px solid var(--hair); box-shadow: var(--e2); border-radius: var(--r-md); }
  .opt { height: 32px; padding: 0 12px; border-radius: var(--r-pill); border: 0; background: transparent; color: var(--ink); font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: center; transition: background-color 0.15s; }
  .opt:hover { background: var(--ink-6); }
  .opt.on { background: var(--on-bg); color: var(--on-fg); box-shadow: var(--on-ring); }
  .opt.on:hover { background: var(--on-bg-hover); }
  .vol { position: relative; display: flex; align-items: center; gap: 10px; flex: none; color: var(--muted); }
  .pct { position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); padding: 3px 8px; border-radius: var(--r-sm); background: var(--chrome); border: 1px solid var(--hair); box-shadow: var(--e2); pointer-events: none; font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink); }
  /* narrower than one row can hold (tools never overlap the transport): name and tools share row 1, transport row 2 */
  footer.tight { grid-template-columns: minmax(0, 1fr) auto; gap: 8px 16px; }
  footer.tight .now { grid-column: 1; grid-row: 1; } footer.tight .tools { grid-column: 2; grid-row: 1; }
  footer.tight .btns { grid-column: 1 / -1; grid-row: 2; } footer.tight .scrub { grid-row: 3; }
  /* very narrow: one column, name / transport / tools / seek */
  footer.slim { grid-template-columns: minmax(0, 1fr); }
  footer.slim .now, footer.slim .tools, footer.slim .btns { grid-column: 1; }
  footer.slim .now { grid-row: 1; } footer.slim .btns { grid-row: 2; } footer.slim .tools { grid-row: 3; justify-content: center; } footer.slim .scrub { grid-row: 4; }
</style>
