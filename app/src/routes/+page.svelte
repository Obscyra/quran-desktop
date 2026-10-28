<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { pageFonts } from '$lib/fonts.svelte';
  import { dataSync } from '$lib/datasync.svelte';
  import { notifier } from '$lib/notifications.svelte';
  import { player } from '$lib/player.svelte';
  import { goBack, goForward } from '$lib/actions';
  import { isTauri, winHide } from '$lib/platform';
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
  import HintCard from '$lib/components/HintCard.svelte';
  import NoticeCard from '$lib/components/NoticeCard.svelte';
  import Welcome from '$lib/components/Welcome.svelte';
  import CopyMenu from '$lib/components/CopyMenu.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import WordMenu from '$lib/components/WordMenu.svelte';
  import TitleBar from '$lib/components/TitleBar.svelte';

  // the buttons under the taskbar preview (Windows) and the system media controls (macOS, Linux): tell the shell what is
  // playing, and act on its Previous / Play / Next
  $effect(() => {
    if (!isTauri()) return;
    const playing = player.playing;
    const title = (settings.arabicNames ? player.current?.name_arabic : player.current?.name_simple) ?? 'Quran';
    const artist = player.reciters.find((r) => r.id === player.reciterId)?.name ?? 'Quran';
    import('@tauri-apps/api/core').then(({ invoke }) => invoke('media_state', { playing, title, artist }).catch(() => {}));
  });
  onMount(() => {
    if (!isTauri()) return;
    let off: (() => void) | undefined;
    let gone = false;
    import('@tauri-apps/api/event').then(async ({ listen }) => {
      const un = await listen<string>('media-control', (e) => {
        const act = e.payload;
        if (act === 'prev') player.prev();
        else if (act === 'next') player.next();
        else if (act === 'play' || act === 'pause' || act === 'toggle') {
          if (act === 'play' ? player.playing : act === 'pause' ? !player.playing : false) return;
          ui.listening = true;
          player.toggle();
        }
      });
      if (gone) un();
      else off = un;
    });
    return () => {
      gone = true;
      off?.();
    };
  });

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

  // the web view's own page menu (Back, Refresh, Save as, Print, More tools) means nothing in an app: only text boxes keep
  // theirs, for paste. The word, verse-number and surah menus are the app's own and set their own handlers.
  let copyMenu: CopyMenu;
  function noBrowserMenu(e: MouseEvent) {
    if (e.defaultPrevented || (e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable="true"]')) return;
    e.preventDefault();
    // selected text: a menu with Copy only
    copyMenu?.show(e);
  }
  const soften = (_: Element, o: { duration: number }) => ({ duration: o.duration, css: (t: number) => `opacity: ${t}` });

  // Settings fades in over the page; the reader stays mounted (so coming back is instant) but is not laid out meanwhile
  const readerGone = $derived(ui.settingsOpen);

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
    if (ui.welcome || t.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
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

  /* After the window comes back from the tray the page can keep a stale height and a scroll offset, which hides
     the top bar and the player. Measure the real window again, and put the page back at the top. */
  function fit() {
    document.documentElement.style.setProperty('--vh', window.innerHeight + 'px');
    const s = document.scrollingElement;
    if (s && (s.scrollTop || s.scrollLeft)) s.scrollTo(0, 0);
    if (document.body.scrollTop || document.body.scrollLeft) document.body.scrollTo(0, 0);
  }
  function refit() {
    fit();
    for (const ms of [60, 300, 1000]) window.setTimeout(fit, ms);
  }

  onMount(() => {
    fit();
    window.addEventListener('resize', refit);
    window.addEventListener('focus', refit);
    window.addEventListener('scroll', fit);
    document.addEventListener('visibilitychange', refit);
    player.init();
    notifier.start();
    dataSync.start();
    ui.syncFullscreen();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onMq = () => (systemDark = mq.matches);
    mq.addEventListener('change', onMq);

    // Updates: look at launch and every few hours; download quietly, install on restart or quit.
    // A failed check (no connection at launch, say) is tried again soon, not in hours.
    let retries = 0;
    const tick = async () => {
      if (!settings.checkUpdates) return;
      await updater.check();
      if (updater.state === 'error' && retries++ < 4) setTimeout(tick, 10 * 60 * 1000);
      else if (updater.state !== 'error') retries = 0;
    };
    setTimeout(tick, 4000);
    const timer = window.setInterval(tick, 2 * 3600 * 1000);

    let unlisten: (() => void) | undefined;
    if (isTauri()) {
      import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
        unlisten = await getCurrentWindow().onCloseRequested(async (ev) => {
          if (!updater.pending) {
            // closing the window leaves the app in the tray, where reminders keep arriving
            if (settings.background) {
              ev.preventDefault();
              await winHide();
              notifier.trayHint();
            }
            return;
          }
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
      window.removeEventListener('resize', refit);
      window.removeEventListener('focus', refit);
      window.removeEventListener('scroll', fit);
      document.removeEventListener('visibilitychange', refit);
      clearInterval(timer);
      unlisten?.();
    };
  });
</script>

<svelte:window onkeydown={keys} onmousemove={toChrome} onmousedown={sideButton} onmouseup={sideButton} onauxclick={sideButton} oncontextmenu={noBrowserMenu} />

<div class="app" class:focus={ui.focus} class:idle={ui.focus && !ui.chromeVisible}>
  <TitleBar hidden={ui.focus && !ui.chromeVisible} />
  <div class="body">
    <Sidebar />
    <div class="main">
      <!-- the reader stays where it is while Settings is open, so coming back is instant -->
      <div class="pane" class:gone={readerGone} inert={ui.settingsOpen}><Reader /></div>
      {#if ui.settingsOpen}
        <div class="over" in:soften={{ duration: 180 }} out:soften={{ duration: 140 }}><Settings /></div>
      {/if}
    </div>
  </div>
  <PlayerBar />
  <NetBar />
  <WordMenu />
  <CopyMenu bind:this={copyMenu} />
  <Tooltip />
  <NoticeCard />
  <HintCard />
  {#if ui.welcome}<Welcome />{/if}
  <ConfirmDialog />

  {#if updater.pending && !ui.focus}
    <aside class="toast" role="status">
      <span>Version {updater.version} is ready</span>
      <button onclick={() => updater.installAndRestart()}>Restart to update</button>
    </aside>
  {/if}
</div>

<style>
  /* `zoom` scales the interface; the height is divided back so the app still fills the window exactly */
  .app { position: relative; display: flex; flex-direction: column; height: calc(var(--vh, 100vh) / var(--zoom, 1)); zoom: var(--zoom, 1); }
  .app.idle { cursor: none; }
  .body { flex: 1; min-height: 0; display: flex; position: relative; }
  .main { flex: 1; min-width: 0; display: flex; position: relative; }
  .pane { flex: 1; min-width: 0; display: flex; }
  .pane.gone { display: none; }
  .over { position: absolute; inset: 0; display: flex; background: var(--bg); z-index: 5; }
  .toast { position: fixed; bottom: 14px; left: 14px; display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 16px; border-radius: 10px; background: var(--panel); border: 1px solid var(--line); box-shadow: 0 12px 32px -12px #000a; animation: in 0.45s var(--ease); z-index: 40; font-size: 13px; }
  .toast button { padding: 6px 12px; border-radius: 7px; background: var(--accent); color: var(--accent-ink); font-weight: 550; }
  @keyframes in { from { transform: translateY(12px); opacity: 0; } }
</style>
