<script lang="ts">
  import { onMount } from 'svelte';
  import { detectOs, onWindowResized, winClose, winIsMaximized, winMinimize, winToggleMaximize } from '$lib/platform';
  import { player } from '$lib/player.svelte';
  import { settings } from '$lib/settings.svelte';
  import { goBack, goForward } from '$lib/actions';
  import { ui } from '$lib/ui.svelte';

  const os = detectOs();
  /** Back leaves Settings first; otherwise it steps back through the surahs you opened. */
  let maximized = $state(false);

  onMount(() => {
    // only Windows draws its own window buttons; macOS and Linux have the system's title bar
    if (os !== 'windows') return;
    const sync = () => winIsMaximized().then((m) => (maximized = m)).catch(() => {});
    sync();
    let off: (() => void) | undefined;
    onWindowResized(sync).then((u) => (off = u)).catch(() => {});
    return () => off?.();
  });
</script>

<header class="bar" data-tauri-drag-region>
  <div class="left" data-tauri-drag-region>
    <button class="tool" class:active={settings.sidebar} onclick={() => ui.toggleSidebar()} aria-label="Toggle surah list (B)" aria-pressed={settings.sidebar} title="Surah list (B)">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" />{#if settings.sidebar}<path d="M5 3h4v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="currentColor" stroke="none" opacity=".3" />{/if}</svg>
    </button>
    <div class="hist" role="group" aria-label="History">
      <button class="tool" onclick={goBack} disabled={!player.canBack && !ui.settingsOpen} aria-label="Back" title="Back">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <button class="tool" onclick={goForward} disabled={!player.canForward} aria-label="Forward" title="Forward">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
    <span class="brand" data-tauri-drag-region>Quran<i class="beta">Beta</i></span>
  </div>

  <div class="center" data-tauri-drag-region>
    <div class="seg" role="radiogroup" aria-label="Reading mode" data-view={settings.mode}>
      <i aria-hidden="true"></i>
      <button role="radio" aria-checked={settings.mode === 'verse'} onclick={() => { settings.mode = 'verse'; ui.closeSettings(); }}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h.01" /><path d="M3 18h.01" /><path d="M3 6h.01" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M8 6h13" /></svg>Verse by Verse
      </button>
      <button role="radio" aria-checked={settings.mode === 'reading'} onclick={() => { settings.mode = 'reading'; ui.closeSettings(); }}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>Reading
      </button>
    </div>
  </div>

  <div class="right" data-tauri-drag-region>
    <button class="tool labeled play" class:active={player.playing} onclick={() => player.toggle()} aria-label={player.playing ? 'Pause' : 'Play the recitation'} title={player.playing ? 'Pause (Space)' : 'Play the recitation (Space)'}>
      <i aria-hidden="true">
        {#if player.playing}
          <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></svg>
        {:else}
          <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3" /></svg>
        {/if}
      </i>
      <span>{player.playing ? 'Pause' : 'Play'}</span>
    </button>
    <button class="tool" class:active={ui.fullscreen} onclick={() => ui.toggleFullscreen()} aria-label="Full screen (F)" aria-pressed={ui.fullscreen} title="Full screen (F)">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
    </button>
    <button class="tool" class:active={ui.settingsOpen} onclick={() => ui.toggleSettings()} aria-label="Settings (,)" aria-pressed={ui.settingsOpen} title="Settings (,)">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
    </button>

    {#if os === 'windows'}
      <div class="win" role="group" aria-label="Window controls">
        <button onclick={() => winMinimize()} aria-label="Minimize">
          <svg aria-hidden="true" viewBox="0 0 10 10" width="10" height="10"><path d="M0 5.5h10" stroke="currentColor" stroke-width="1" /></svg>
        </button>
        <button onclick={() => winToggleMaximize()} aria-label={maximized ? 'Restore' : 'Maximize'}>
          {#if maximized}
            <svg aria-hidden="true" viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor"><path d="M2.5 2.5V.5h7v7h-2" /><rect x=".5" y="2.5" width="7" height="7" /></svg>
          {:else}
            <svg aria-hidden="true" viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor"><rect x=".5" y=".5" width="9" height="9" /></svg>
          {/if}
        </button>
        <button class="close" onclick={() => winClose()} aria-label="Close">
          <svg aria-hidden="true" viewBox="0 0 10 10" width="10" height="10"><path d="M.5.5l9 9M9.5.5l-9 9" stroke="currentColor" stroke-width="1" fill="none" /></svg>
        </button>
      </div>
    {/if}
  </div>
</header>

<style>
  /* the title bar shares the sidebar's chrome surface; there is no line between them */
  .bar {
    container-type: inline-size;
    height: 40px; flex: none; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    background: var(--chrome); user-select: none; -webkit-user-select: none; position: relative; z-index: 30;
    transition: transform 0.4s var(--ease), opacity 0.3s var(--ease);
  }
  .left, .right { display: flex; align-items: center; height: 100%; min-width: 0; }
  .left { gap: 4px; padding-left: 8px; }
  .right { justify-content: flex-end; gap: 4px; padding-right: 0; }
  .brand { font-size: 13.5px; font-weight: 600; color: var(--muted); padding: 0 8px; pointer-events: none; }
  .beta { font-style: normal; margin-left: 7px; padding: 1px 6px; border-radius: var(--r-pill); background: var(--accent-soft); color: var(--accent); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
  .hist { display: flex; gap: 2px; margin: 0; padding: 0; }
  /* a narrow window (or a large interface size) drops the app name to keep the controls clear */
  @container (max-width: 900px) { .brand { display: none; } .seg button { padding: 0 10px; } }
  .center { display: flex; justify-content: center; }

  .tool { width: 32px; height: 32px; border-radius: var(--r-sm); display: grid; place-items: center; color: var(--muted); background: transparent; border: 0; transition: background-color 0.15s, color 0.15s; }
  .tool:hover:not(:disabled) { background: var(--ink-6); color: var(--ink); }
  .tool:active:not(:disabled) { background: var(--ink-6); transform: scale(0.97); }
  .tool.active { color: var(--accent); background: transparent; }
  .tool.play i { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: var(--accent-ink); }
  .tool.play { color: var(--ink); }
  .tool.play.active { color: var(--ink); }
  .tool.labeled { width: auto; height: 28px; display: inline-flex; align-items: center; gap: 8px; padding: 0 12px 0 8px; border-radius: var(--r-pill); background: color-mix(in oklab, var(--accent) 14%, transparent); font-size: 13.5px; font-weight: 500; }
  .tool.labeled:hover:not(:disabled) { background: color-mix(in oklab, var(--accent) 20%, transparent); }
  @container (max-width: 900px) { .tool.labeled { width: 32px; padding: 0; justify-content: center; } .tool.labeled span { display: none; } }
  .tool:disabled { opacity: 0.35; }

  /* the one segmented control: a recessed track and a raised selected segment */
  .seg { display: inline-flex; background: var(--ink-6); border-radius: var(--r-md); padding: 3px; gap: 2px; }
  .seg i { display: none; }
  .seg button { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; height: 26px; border-radius: var(--r-sm); font-size: 13.5px; font-weight: 500; color: var(--muted); transition: color 0.2s, background-color 0.2s; }
  .seg button:hover { color: var(--ink); }
  .seg button[aria-checked='true'] { background: color-mix(in oklab, var(--bg) 70%, var(--ink) 12%); color: var(--ink); box-shadow: var(--e1); }

  /* the tools sit left of the window controls with a clear gap, and a little air from the edge when there are none */
  .right > .tool:last-of-type { margin-right: 8px; }
  .win { display: flex; height: 100%; margin-left: 0; }
  .win button { width: 46px; height: 100%; display: grid; place-items: center; color: var(--muted); transition: background-color 0.12s, color 0.12s; }
  .win button:hover { background: var(--ink-6); color: var(--ink); }
  .win button:active { background: var(--hair-2); }
  .win .close:hover { background: #c42b1c; color: #fff; }
  .win .close:active { background: #b02a1e; color: #fff; }
</style>
