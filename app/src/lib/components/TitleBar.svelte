<script lang="ts">
  import { onMount } from 'svelte';
  import { detectOs, onWindowResized, winClose, winIsMaximized, winMinimize, winToggleMaximize } from '$lib/platform';
  import { player } from '$lib/player.svelte';
  import { settings } from '$lib/settings.svelte';
  import { goBack, goForward } from '$lib/actions';
  import { FOCUS_MODE, ui } from '$lib/ui.svelte';

  let { hidden = false }: { hidden?: boolean } = $props();

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

<header class="bar" class:hidden inert={hidden} data-tauri-drag-region>
  <div class="left" data-tauri-drag-region>
    <button class="tool" class:active={settings.sidebar} onclick={() => ui.toggleSidebar()} aria-label="Toggle surah list (B)" aria-pressed={settings.sidebar} title="Surah list (B)">
      <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2.5" y="3.5" width="15" height="13" rx="2.5" /><path d="M7.5 3.5v13" />{#if settings.sidebar}<path d="M2.5 6a2.5 2.5 0 0 1 2.5-2.5h2.5v13H5A2.5 2.5 0 0 1 2.5 14z" fill="currentColor" stroke="none" opacity=".35" />{/if}</svg>
    </button>
    <div class="hist" role="group" aria-label="History">
      <button class="tool" onclick={goBack} disabled={!player.canBack && !ui.settingsOpen} aria-label="Back" title="Back">
        <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>
      </button>
      <button class="tool" onclick={goForward} disabled={!player.canForward} aria-label="Forward" title="Forward">
        <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>
      </button>
    </div>
    <span class="brand" data-tauri-drag-region>Quran<i class="beta">Beta</i></span>
  </div>

  <div class="center" data-tauri-drag-region>
    <div class="seg" role="radiogroup" aria-label="Reading mode" data-view={settings.mode}>
      <i aria-hidden="true"></i>
      <button role="radio" aria-checked={settings.mode === 'verse'} onclick={() => { settings.mode = 'verse'; ui.closeSettings(); }}>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 5h12M4 8.5h12M4 12h12M4 15.5h8" /></svg>Verse by Verse
      </button>
      <button role="radio" aria-checked={settings.mode === 'reading'} onclick={() => { settings.mode = 'reading'; ui.closeSettings(); }}>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M10 5.2C8.4 4.2 5.6 3.8 2.8 4.4v10.8c2.8-.6 5.6-.2 7.2.8 1.6-1 4.4-1.4 7.2-.8V4.4c-2.8-.6-5.6-.2-7.2.8zM10 5.2V16" /></svg>Reading
      </button>
    </div>
  </div>

  <div class="right" data-tauri-drag-region>
    <button class="tool labeled play" class:active={player.playing} onclick={() => player.toggle()} aria-label={player.playing ? 'Pause' : 'Play the recitation'} title={player.playing ? 'Pause (Space)' : 'Play the recitation (Space)'}>
      <i aria-hidden="true">
        {#if player.playing}
          <svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" fill="currentColor" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" width="12" height="12"><path d="M7.5 4.6v14.8a.8.8 0 0 0 1.22.68l12-7.4a.8.8 0 0 0 0-1.36l-12-7.4a.8.8 0 0 0-1.22.68z" fill="currentColor" /></svg>
        {/if}
      </i>
      <span>{player.playing ? 'Pause' : 'Play'}</span>
    </button>
    {#if FOCUS_MODE}
      <button class="tool" class:active={ui.focus} onclick={() => ui.toggleFocus()} aria-label="Focus mode (Z)" aria-pressed={ui.focus} title="Focus mode (Z)">
        <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.8 10S4.6 4.5 10 4.5 18.2 10 18.2 10 15.4 15.5 10 15.5 1.8 10 1.8 10z" /><circle cx="10" cy="10" r="2.4" /></svg>
      </button>
    {/if}
    <button class="tool" class:active={ui.fullscreen} onclick={() => ui.toggleFullscreen()} aria-label="Full screen (F)" aria-pressed={ui.fullscreen} title="Full screen (F)">
      <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4" /></svg>
    </button>
    <button class="tool" class:active={ui.settingsOpen} onclick={() => ui.toggleSettings()} aria-label="Settings (,)" aria-pressed={ui.settingsOpen} title="Settings (,)">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
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
  .bar {
    container-type: inline-size;
    height: 40px; flex: none; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    background: var(--bg-2); user-select: none; -webkit-user-select: none; position: relative; z-index: 30;
    transition: transform 0.4s var(--ease), opacity 0.3s var(--ease);
  }
  .bar.hidden { transform: translateY(-100%); opacity: 0; pointer-events: none; }
  :global(.app.focus) .bar { position: fixed; inset: 0 0 auto 0; }
  .left, .right { display: flex; align-items: center; height: 100%; min-width: 0; }
  .left { gap: 4px; padding-left: 8px; }
  .right { justify-content: flex-end; gap: 6px; padding-right: 0; }
  .right > .tool:last-of-type { margin-right: 6px; }
  .brand { font-size: 13px; font-weight: 600; color: var(--ink-dim); padding: 0 8px; pointer-events: none; }
  .beta { font-style: normal; margin-left: 7px; padding: 1px 6px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; }
  .hist { display: flex; margin: 0 2px 0 4px; padding-right: 6px; border-right: 1px solid var(--line); }
  /* a narrow window (or a large interface size) drops the app name to keep the controls clear */
  @container (max-width: 900px) { .brand { display: none; } .seg button { padding: 0 10px; } }
  .center { display: flex; justify-content: center; }

  .tool { width: 34px; height: 30px; border-radius: 8px; display: grid; place-items: center; color: var(--ink-dim); background: var(--btn); border: 1px solid var(--btn-line); transition: background-color 0.15s, color 0.15s, border-color 0.15s; }
  .tool:hover:not(:disabled) { background: var(--btn-hover); color: var(--ink); }
  .tool:active:not(:disabled) { background: var(--btn-hover); transform: scale(0.97); }
  .tool.active { color: var(--accent); background: var(--btn-on); }
  .tool.play i { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: var(--accent-ink); }
  .tool.play { color: var(--ink); }
  .tool.play.active { color: var(--ink); }
  .tool.labeled { width: auto; display: inline-flex; align-items: center; gap: 7px; padding: 0 11px 0 9px; font-size: 12.5px; font-weight: 600; }
  @container (max-width: 900px) { .tool.labeled { width: 34px; padding: 0; justify-content: center; } .tool.labeled span { display: none; } }
  .tool:disabled { opacity: 0.35; }

  .seg { position: relative; display: grid; grid-template-columns: 1fr 1fr; background: var(--btn); border: 1px solid var(--btn-line); border-radius: 10px; padding: 2px; }
  .seg i { position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc(50% - 2px); border-radius: 8px; background: var(--sel); transition: transform 0.28s var(--ease); }
  .seg[data-view='reading'] i { transform: translateX(100%); }
  .seg button { position: relative; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 14px; height: 26px; border-radius: 7px; font-size: 12.5px; font-weight: 600; color: var(--ink-dim); transition: color 0.2s; }
  .seg button[aria-checked='true'] { color: var(--accent); }

  .win { display: flex; height: 100%; margin-left: 4px; }
  .win button { width: 46px; height: 100%; display: grid; place-items: center; color: var(--ink); transition: background-color 0.12s; }
  .win button:hover { background: color-mix(in srgb, var(--ink) 10%, transparent); }
  .win button:active { background: color-mix(in srgb, var(--ink) 16%, transparent); }
  .win .close:hover { background: #c42b1c; color: #fff; }
  .win .close:active { background: #b02a1e; color: #fff; }
</style>
