<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { pageFonts } from '$lib/fonts.svelte';
  import { notifier } from '$lib/notifications.svelte';
  import { player } from '$lib/player.svelte';
  import { goBack, goForward } from '$lib/actions';
  import { isTauri } from '$lib/platform';
  import { reader } from '$lib/reader.svelte';
  import { settings } from '$lib/settings.svelte';
  import { applyTheme, resolveTheme } from '$lib/themes';
  import { ui } from '$lib/ui.svelte';
  import { updater } from '$lib/updater.svelte';
  import NetBar from '$lib/components/NetBar.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Reader from '$lib/components/Reader.svelte';
  import PlayerBar from '$lib/components/PlayerBar.svelte';
  import Settings from '$lib/components/Settings.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import NoticeCard from '$lib/components/NoticeCard.svelte';
  import WordMenu from '$lib/components/WordMenu.svelte';
  import TitleBar from '$lib/components/TitleBar.svelte';

  let systemDark = $state(matchMedia('(prefers-color-scheme: dark)').matches);

  $effect(() => {
    const t = resolveTheme(settings.theme, systemDark);
    applyTheme(t);
    document.documentElement.dataset.theme = t.id;
  });
  $effect(() => {
    settings.snapshot();
    settings.save();
  });
  // interface size: the whole app is scaled, so menus, lists and buttons all follow
  $effect(() => {
    document.documentElement.style.setProperty('--zoom', String(settings.uiScale));
  });

  const toChrome = () => ui.poke();
  const paged = $derived(settings.mode === 'reading' && settings.readingStyle === 'arabic' && settings.flow === 'page');

  // switching to a script that needs IndoPak spellings or layout: fetch them for the open surah
  $effect(() => {
    if (settings.needsIndo && player.verses.length && !player.verses[0].words[0]?.indo) untrack(() => player.refreshText());
  });
  // glyph fonts for the open surah, if the script needs them
  $effect(() => {
    if (settings.script === 'mushaf' && player.verses.length) {
      const pages = new Set<number>();
      for (const v of player.verses) {
        for (const w of v.words) pages.add(w.gp);
        pages.add(v.endPage);
      }
      pageFonts.ensure(pages);
    }
  });

  /** The back and forward buttons on the side of a mouse (buttons 3 and 4) walk the same trail as the arrows. */
  function sideButton(e: MouseEvent) {
    if (e.button !== 3 && e.button !== 4) return;
    e.preventDefault();
    if (e.type !== 'mouseup') return;
    if (e.button === 3) goBack();
    else if (player.canForward) goForward();
  }

  function keys(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') {
      e.preventDefault();
      player.toggle();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      // listening: step verses. Otherwise in pages, turn them (Arabic reads right to left).
      if (ui.listening && player.audio) player.seekVerse(dir);
      else if (paged) reader.go(-dir);
    }
    else if (e.key === 'PageDown' || (paged && e.key === 'ArrowDown')) {
      e.preventDefault();
      reader.go(1);
    } else if (e.key === 'PageUp' || (paged && e.key === 'ArrowUp')) {
      e.preventDefault();
      reader.go(-1);
    } else if (e.key === 'z' || e.key === 'Z') ui.toggleFocus();
    else if (e.key === 'f' || e.key === 'F') ui.toggleFullscreen();
    else if (e.key === 'b' || e.key === 'B') ui.toggleSidebar();
    else if (e.key === 'p' || e.key === 'P') settings.mode = settings.mode === 'verse' ? 'reading' : 'verse';
    else if (e.key === 't' || e.key === 'T') settings.spread = !settings.spread;
    else if (e.key === 'l' || e.key === 'L') ui.toggleListening();
    else if (e.key === 'r' || e.key === 'R') settings.readingStyle = settings.readingStyle === 'arabic' ? 'translation' : 'arabic';
    else if (e.key === ',') ui.toggleSettings();
    else if (e.key === 'Escape') {
      if (ui.settingsOpen) ui.closeSettings();
      else if (ui.focus) ui.toggleFocus();
      else if (ui.fullscreen) ui.toggleFullscreen();
    }
  }

  onMount(() => {
    player.init();
    notifier.start();
    ui.syncFullscreen();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onMq = () => (systemDark = mq.matches);
    mq.addEventListener('change', onMq);

    // Updates: look at launch and every few hours; download quietly, install on restart or quit.
    const tick = () => settings.checkUpdates && updater.check();
    setTimeout(tick, 4000);
    const timer = window.setInterval(tick, 6 * 3600 * 1000);

    let unlisten: (() => void) | undefined;
    if (isTauri()) {
      import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
        unlisten = await getCurrentWindow().onCloseRequested(async (ev) => {
          if (!updater.pending) return;
          ev.preventDefault();
          try {
            await updater.installAndExit();
          } catch {
            // the update could not be applied: never leave the window stuck, just close
            await getCurrentWindow().destroy();
          }
        });
      });
    }
    return () => {
      mq.removeEventListener('change', onMq);
      clearInterval(timer);
      unlisten?.();
    };
  });
</script>

<svelte:window onkeydown={keys} onmousemove={toChrome} onmousedown={sideButton} onmouseup={sideButton} onauxclick={sideButton} />

<div class="app" class:focus={ui.focus} class:idle={ui.focus && !ui.chromeVisible}>
  <TitleBar hidden={ui.focus && !ui.chromeVisible} />
  <div class="body">
    <Sidebar />
    {#if ui.settingsOpen}
      <Settings />
    {:else}
      <Reader />
    {/if}
  </div>
  <PlayerBar />
  <NetBar />
  <WordMenu />
  <NoticeCard />
  <ConfirmDialog />

  {#if updater.pending && !ui.focus}
    <aside class="toast" role="status">
      <span>Version {updater.version} is ready.</span>
      <button onclick={() => updater.installAndRestart()}>Restart to update</button>
    </aside>
  {/if}
</div>

<style>
  /* `zoom` scales the interface; the height is divided back so the app still fills the window exactly */
  .app { position: relative; display: flex; flex-direction: column; height: calc(100vh / var(--zoom, 1)); zoom: var(--zoom, 1); }
  .app.idle { cursor: none; }
  .body { flex: 1; min-height: 0; display: flex; }
  .toast { position: fixed; top: 52px; right: 14px; display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 16px; border-radius: 10px; background: var(--panel); border: 1px solid var(--line); box-shadow: 0 12px 32px -12px #000a; animation: in 0.45s var(--ease); z-index: 40; font-size: 13px; }
  .toast button { padding: 6px 12px; border-radius: 7px; background: var(--accent); color: var(--accent-ink); font-weight: 550; }
  @keyframes in { from { transform: translateY(-12px); opacity: 0; } }
</style>
