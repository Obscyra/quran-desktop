<script lang="ts">
  import { player } from '$lib/player.svelte';
  import { settings } from '$lib/settings.svelte';
  import { ui } from '$lib/ui.svelte';
  import ReciterPicker from './ReciterPicker.svelte';

  const hidden = $derived(ui.focus && !ui.chromeVisible);
  const shown = $derived(ui.listening || settings.listenBar === 'always');

  const fmt = (s: number) => {
    s = Math.max(0, Math.floor(s || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
    player.downloading === player.chapter || (player.dl.running && player.dl.reciter === player.reciterId && player.dl.current.includes(player.chapter))
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

<footer class:hidden class:closed={!shown} inert={hidden || !shown} aria-label="Listening">
  <div class="now">
    <button class="np" onclick={showPlaying} title="Go to the verse being recited" aria-label="Now playing: {player.current?.name_simple ?? ''}{playingVerse ? ', verse ' + playingVerse : ''}. Go to it">
      <b>{settings.arabicNames ? (player.current?.name_arabic ?? '—') : (player.current?.name_simple ?? '—')}</b>
      {#if playingVerse}<span class="vs">Verse {playingVerse}<i>/ {player.current?.verses_count}</i></span>{/if}
      {#if player.loopVerse}<em>· repeating</em>{/if}
    </button>
    <ReciterPicker compact />
  </div>

  <div class="mid">
    <div class="btns">
      <button class="ctl" onclick={() => player.prev()} aria-label="Previous surah" title="Previous surah">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M5 5h3v14H5zM20 5.2v13.6a.8.8 0 0 1-1.25.66L9 12.66a.8.8 0 0 1 0-1.32l9.75-6.8A.8.8 0 0 1 20 5.2z" fill="currentColor" /></svg>
      </button>
      <button class="ctl" onclick={() => player.stepVerse(-1)} aria-label="Previous verse" title="Previous verse">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 5.5-6.5 6.5 6.5 6.5" /></svg>
      </button>
      <button class="play" onclick={() => player.toggle()} aria-label={player.playing ? 'Pause' : 'Play'} >
        {#if player.playing}
          <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" fill="currentColor" /></svg>
        {:else}
          <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><path d="M7.5 4.6v14.8a.8.8 0 0 0 1.22.68l12-7.4a.8.8 0 0 0 0-1.36l-12-7.4a.8.8 0 0 0-1.22.68z" fill="currentColor" /></svg>
        {/if}
      </button>
      <button class="ctl" onclick={() => player.stepVerse(1)} aria-label="Next verse" title="Next verse">
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
      </div>
      <span>{fmt(player.duration)}</span>
    </div>
  </div>

  <div class="tools">
    <button class="chip" onclick={cycleSpeed} title="Playback speed" aria-label="Playback speed {settings.speed}×">{settings.speed}×</button>
    <label class="vol" title="Volume">
      <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8v4h3l4 3.5v-11L6 8z" /><path d="M13.5 7.5a3.5 3.5 0 0 1 0 5" /></svg>
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
  footer.closed { position: absolute; inset: auto 0 0 0; transform: translateY(100%); opacity: 0; pointer-events: none; }
  .now em { font-style: normal; font-weight: 400; color: var(--accent); }
  .chip.x { width: 28px; padding: 0; display: grid; place-items: center; }
  .dl { position: relative; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--ink); transition: background-color 0.15s, color 0.15s; }
  .dl:hover:not(:disabled) { background: color-mix(in srgb, var(--ink) 10%, transparent); }
  .dl.done { color: var(--accent); }
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
  .vol { display: flex; align-items: center; gap: 6px; color: var(--ink-dim); }
  .vol input { width: 78px; height: 20px; accent-color: var(--accent); }
</style>
