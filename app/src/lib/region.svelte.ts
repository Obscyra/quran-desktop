import { isTauri } from './platform';

/**
 * The country or region set in the system (Windows: Country or region; macOS: Language & Region; Linux: the locale
 * territory), as a two-letter code such as "BD". It is looked up once at startup so the welcome screen can suggest a
 * translation language without waiting for it (a Bangladeshi PC with an English system still wants Bengali).
 */
class DeviceRegion {
  #region = $state<string | null>(null);
  #ready = $state(false);
  private started = false;

  /** the region once the lookup has finished */
  get region() {
    return this.#region;
  }
  /** true once the lookup has finished; the value above is then final */
  get ready() {
    return this.#ready;
  }

  private async fetch() {
    if (this.started) return;
    this.started = true;
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        this.#region = await invoke<string | null>('device_region');
      } catch {
        /* the browser's language list is enough */
      }
    }
    this.#ready = true;
  }

  /** Kick off the region lookup at startup; the result arrives reactively and never blocks the welcome screen. */
  ensure() {
    this.fetch();
  }
}

export const deviceRegion = new DeviceRegion();