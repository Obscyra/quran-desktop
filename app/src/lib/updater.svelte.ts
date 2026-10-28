import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater';
import { isTauri } from './platform';

type State = 'idle' | 'checking' | 'downloading' | 'ready' | 'uptodate' | 'error' | 'unavailable';

// The update is downloaded in the background as soon as it is found. Installing is a separate,
// quick step that runs when the user restarts (or quits), so nothing interrupts a recitation.
class Updater {
  state = $state<State>('idle');
  version = $state('');
  /** the release notes of the update that was found */
  notes = $state('');
  progress = $state(0);
  error = $state('');
  lastChecked = $state<number | null>(null);

  private update: Update | null = null;

  async check() {
    if (!isTauri()) {
      this.state = 'unavailable';
      return;
    }
    if (this.state === 'checking' || this.state === 'downloading' || this.state === 'ready') return;
    this.state = 'checking';
    this.error = '';
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      this.lastChecked = Date.now();
      if (!update) {
        this.state = 'uptodate';
        return;
      }
      this.version = update.version;
      this.notes = (update.body ?? '').trim();
      this.state = 'downloading';
      let total = 0;
      let got = 0;
      await update.download((e: DownloadEvent) => {
        if (e.event === 'Started') total = e.data.contentLength ?? 0;
        if (e.event === 'Progress') {
          got += e.data.chunkLength;
          if (total) this.progress = got / total;
        }
      });
      this.update = update;
      this.state = 'ready';
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.state = 'error';
    }
  }

  get pending() {
    return this.state === 'ready';
  }

  async installAndRestart() {
    if (!this.update) return;
    try {
      await this.update.install();
    } catch (e) {
      // the installer could not run: say so and look again at the next check
      this.error = e instanceof Error ? e.message : String(e);
      this.state = 'error';
      return;
    }
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  }

  /** Quit path: apply a downloaded update instead of throwing it away. */
  async installAndExit() {
    if (!this.update) throw new Error('no downloaded update');
    // an installer that stalls must not trap the window open
    await Promise.race([this.update.install(), new Promise((_, no) => setTimeout(() => no(new Error('install timed out')), 15000))]);
    const { exit } = await import('@tauri-apps/plugin-process');
    await exit(0);
  }
}

export const updater = new Updater();
