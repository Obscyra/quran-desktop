<script lang="ts">
  import { player } from '$lib/player.svelte';
  import { settings } from '$lib/settings.svelte';
  import { ui } from '$lib/ui.svelte';
  import ReciterPicker from './ReciterPicker.svelte';

  const hidden = $derived(ui.focus && !ui.chromeVisible);
  const shown = $derived(ui.listening || settings.listenBar === 'always');

  // "Show on hover": the bar floats over the bottom edge of the page and slides up while the mouse is
  // there (or a control in it has the keyboard); it also shows for a moment when listening starts.
  const float = $derived(settings.playerHover && shown);
  let peek = $state(false);
  let over = false;
  let held = false;
  let peekTimer = 0;
  const open = $derived(shown && (!settings.playerHover || peek));
  function enter() {
    over = true;
    clearTimeout(peekTimer);
    peek = true;
  }
  function leave() {
    over = false;
    clearTimeout(peekTimer);
    if (!held) peekTimer = window.setTimeout(() => (peek = false), 650);
  }
  // a mouse that leaves the window (or a window that loses focus) may never send mouseleave: close from here too
  function away() {
    over = false;
    held = false;
    clearTimeout(peekTimer);
    peekTimer = window.setTimeout(() => (peek = false), 350);
  }
  let bar = $state<HTMLElement>();
  $effect(() => {
    ui.barOver = float && open;
    return () => (ui.barOver = false);
  });
  function track(e: PointerEvent) {
    if (!peek || !over || held || !bar) return;
    if (!bar.contains(e.target as Node)) leave();
  }
  function release() {
    held = false;
    if (!over && peek) leave();
  }
  $effect(() => {
    if (!(ui.listening && settings.playerHover)) return;
    peek = true;
    peekTimer = window.setTimeout(() => !over && !held && (peek = false), 2600);
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
  function cycleSpeed() {
    const i = SPEEDS.indexOf(settings.speed);
    settings.speed = SPEEDS[(i + 1) % SPEEDS.length];
    player.applySpeed();
  }
</script>

<svelte:window onpointerup={release} onpointermove={track} onblur={away} />
<svelte:document onmouseleave={away} />

{#if float && !peek}<div class="zone" role="presentation" onmouseenter={enter} onpointerenter={enter}><i></i></div>{/if}

<footer
  class:hidden
  class:float
  class:closed={!open}
  inert={hidden || !open}
  aria-label="Listening"
  onmouseenter={enter}
  onmouseleave={leave}
  bind:this={bar}
  onfocusin={(e) => e.target instanceof HTMLElement && e.target.matches(':focus-visible') && enter()}
  onfocusout={leave}
  onpointerdown={() => (held = true)}
>
  <div class="now">
    <button class="np" onclick={showPlaying} title="Go to the verse being recited" aria-label="Now playing: {player.current?.name_simple ?? ''}{playingVerse ? ', verse ' + playingVerse : ''}. Go to it">
      <b>{settings.arabicNames ? (player.current?.name_arabic ?? '—') : (player.current?.name_simple ?? '—')}</b>
      {#if player.loadingAudio}<span class="vs load">Loading…</span>{:else if playingVerse}<span class="vs">Verse {playingVerse}<i>/ {player.current?.verses_count}</i></span>{/if}
      {#if player.loopVerse}<em>· repeating</em>{/if}
    </button>
    <ReciterPicker compact />
  </div>

  <div class="mid">
    <div class="btns">
      <button class="ctl" onclick={() => player.prev()} aria-label="Previous surah" title="Previous surah">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M5 5h3v14H5zM20 5.2v13.6a.8.8 0 0 1-1.25.66L9 12.66a.8.8 0 0 1 0-1.32l9.75-6.8A.8.8 0 0 1 20 5.2z" fill="currentColor" /></svg>
      </button>
      <button class="ctl" onclick={() => player.stepVerse(-1)} disabled={!!player.audio?.plain} aria-label="Previous verse" title={player.audio?.plain ? 'This reciter plays whole surahs only' : 'Previous verse'}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 5.5-6.5 6.5 6.5 6.5" /></svg>
      </button>
      <button class="play" onclick={() => player.toggle()} aria-label={player.loadingAudio ? 'Loading the recitation' : player.playing ? 'Pause' : 'Play'} aria-busy={player.loadingAudio}>
        {#if player.loadingAudio}
          <i class="wait" aria-hidden="true"></i>
        {:else if player.playing}
          <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" fill="currentColor" /></svg>
        {:else}
          <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><path d="M7.5 4.6v14.8a.8.8 0 0 0 1.22.68l12-7.4a.8.8 0 0 0 0-1.36l-12-7.4a.8.8 0 0 0-1.22.68z" fill="currentColor" /></svg>
        {/if}
      </button>
      <button class="ctl" onclick={() => player.stepVerse(1)} disabled={!!player.audio?.plain} aria-label="Next verse" title={player.audio?.plain ? 'This reciter plays whole surahs only' : 'Next verse'}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 5.5 6.5 6.5-6.5 6.5" /></svg>
      </button>
      <button class="ctl" onclick={() => player.next()} aria-label="Next surah" title="Next surah">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M16 5h3v14h-3zM4 5.2v13.6a.8.8 0 0 0 1.25.66L15 12.66a.8.8 0 0 0 0-1.32L5.25 4.54A.8.8 0 0 0 4 5.2z" fill="currentColor" /></svg>
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
  </div>

  <div class="tools">
    <button class="chip speed" onclick={cycleSpeed} title="Playback speed" aria-label="Playback speed {settings.speed}×">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.2 17a8.5 8.5 0 1 1 15.6 0" /><path d="m12 13 4-4.5" /><circle cx="12" cy="13.5" r="1.2" fill="currentColor" stroke="none" /></svg>
      {settings.speed}×
    </button>
    <label class="vol" title="Volume">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 9.5v5h3.8l5 4.2V5.3L7.3 9.5z" /><path d="M16 9a4.2 4.2 0 0 1 0 6" />{#if settings.volume > 0.5}<path d="M18.6 6.6a8 8 0 0 1 0 10.8" />{/if}{#if settings.volume === 0}<path d="m16 9.5 4.5 5M20.5 9.5 16 14.5" />{/if}</svg>
      <input type="range" min="0" max="1" step="0.05" bind:value={settings.volume} oninput={() => player.applyVolume()} aria-label="Volume" />
    </label>
    {#if player.isDownloaded}
      <button class="dl done" onclick={() => player.removeDownload()} title="Saved for offline listening. Click to remove" aria-label="Saved offline. Remove the offline copy">
        <svg aria-hidden="true" viewBox="0 0 28 28" width="28" height="28"><circle cx="14" cy="14" r="12" fill="currentColor" /><path d="m8.6 14.4 3.9 3.8 7-8" fill="none" stroke="var(--bg-2)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
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
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></svg>
      </button>
    {/if}
    {#if settings.listenBar === 'demand'}
      <button class="chip x" onclick={() => player.stop()} aria-label="Close player" title="Stop and close">
        <svg aria-hidden="true" viewBox="0 0 10 10" width="10" height="10"><path d="M.5.5l9 9M9.5.5l-9 9" stroke="currentColor" stroke-width="1.2" fill="none" /></svg>
      </button>
    {/if}
  </div>
</footer>

<style>
  footer {
    flex: none; display: grid; grid-template-columns: minmax(180px, 1fr) minmax(300px, 1.5fr) minmax(180px, 1fr); align-items: center; gap: 24px;
    padding: 10px 20px; background: var(--bg-2); border-top: 1px solid var(--line); user-select: none; -webkit-user-select: none; z-index: 30;
    transition: transform 0.4s var(--ease), opacity 0.3s var(--ease);
  }
  /* Closed, the bar leaves the layout at once (the page below it reflows one time) and slides out over the
     bottom edge. Animating its height instead made the page refit on every frame, which stuttered. */
  footer.float { position: absolute; inset: auto 0 0 0; box-shadow: 0 -14px 34px -22px #000c; }
  .zone { position: absolute; inset: auto 0 0 0; height: 44px; z-index: 29; display: flex; justify-content: center; align-items: flex-end; }
  .zone i { width: 64px; height: 4px; margin-bottom: 8px; border-radius: 4px; background: var(--ink-dim); opacity: 0.45; pointer-events: none; }
  footer.closed { position: absolute; inset: auto 0 0 0; transform: translateY(100%); opacity: 0; pointer-events: none; }
  .now em { font-style: normal; font-weight: 400; color: var(--accent); }
  .chip.x { width: 28px; padding: 0; display: grid; place-items: center; }
  .dl { position: relative; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--ink); transition: background-color 0.15s, color 0.15s; }
  .dl:hover:not(:disabled) { background: color-mix(in srgb, var(--ink) 10%, transparent); }
  .dl.done { color: var(--accent); }
  .play .wait { width: 20px; height: 20px; border-radius: 50%; border: 3px solid color-mix(in srgb, var(--bg) 30%, transparent); border-top-color: var(--bg); animation: spin 0.8s linear infinite; }
  .vs.load { color: var(--accent); }
  .bar .clip { position: absolute; inset: 0; overflow: hidden; border-radius: 4px; pointer-events: none; }
  .bar .shimmer { position: absolute; inset: 0; width: 35%; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 70%, transparent), transparent); animation: slide 1.1s ease-in-out infinite; pointer-events: none; }
  @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(300%); } }
  .dl.busy { color: var(--accent); }
  .dl.busy b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 9.5px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
  .dl svg.spin { animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  footer.hidden { transform: translateY(100%); opacity: 0; pointer-events: none; }
  :global(.app.focus) footer { position: fixed; inset: auto 0 0 0; }

  .now { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .np { display: flex; align-items: baseline; gap: 8px; text-align: left; border-radius: 6px; margin: 0 -4px; padding: 1px 4px; min-width: 0; }
  .np:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); }
  .np b { font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vs { font-size: 12.5px; color: var(--accent); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .vs i { font-style: normal; color: var(--ink-dim); margin-left: 3px; }

  .mid { display: flex; flex-direction: column; gap: 6px; align-items: center; }
  .btns { display: flex; align-items: center; gap: 10px; }
  .ctl { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; color: var(--ink); transition: background-color 0.15s, color 0.15s; }
  .ctl:disabled { opacity: 0.35; pointer-events: auto; cursor: not-allowed; }
  .ctl:hover { background: color-mix(in srgb, var(--ink) 9%, transparent); color: var(--ink); }
  .play { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: var(--bg); transition: transform 0.15s var(--ease), opacity 0.15s; }
  .play:hover:not(:disabled) { transform: scale(1.06); }
  .play:active:not(:disabled) { transform: scale(0.96); }
  .play:disabled { opacity: 0.4; }
  .scrub { display: flex; align-items: center; gap: 10px; width: 100%; font-size: 11px; color: var(--ink-dim); font-variant-numeric: tabular-nums; }
  .bar { flex: 1; height: 4px; background: color-mix(in srgb, var(--ink) 16%, transparent); border-radius: 4px; cursor: pointer; position: relative; transition: height 0.15s; }
  .bar::before { content: ''; position: absolute; inset: -8px 0; }
  .bar:hover { height: 6px; }
  .bar i { display: block; height: 100%; background: var(--accent); border-radius: 4px; pointer-events: none; }

  .tools { display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
  .chip { height: 28px; padding: 0 11px; border-radius: 7px; color: var(--ink-dim); font-size: 12px; font-weight: 500; background: color-mix(in srgb, var(--ink) 8%, transparent); transition: background-color 0.15s, color 0.15s; font-variant-numeric: tabular-nums; }
  .chip:hover:not(:disabled) { background: color-mix(in srgb, var(--ink) 14%, transparent); color: var(--ink); }
  .chip:disabled { opacity: 0.5; }
  .chip.speed { height: 36px; padding: 0 13px 0 10px; display: inline-flex; align-items: center; gap: 7px; font-size: 14px; border-radius: 9px; }
  .vol { display: flex; align-items: center; gap: 8px; color: var(--ink-dim); }
  .vol input { width: 96px; height: 24px; accent-color: var(--accent); }
</style>
