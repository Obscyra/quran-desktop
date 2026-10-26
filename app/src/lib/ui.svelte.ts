import { getFullscreen, setFullscreen } from './platform';
import { settings } from './settings.svelte';

export type SettingsArea = 'appearance' | 'text' | 'reading' | 'pages' | 'audio' | 'manager' | 'reminders' | 'focus' | 'shortcuts' | 'updates' | 'data';

/** A reminder or the verse of the day, shown as a card while the reader is in the app. */
export interface Notice {
  kind: 'reminder' | 'verse';
  title: string;
  body: string;
  arabic?: string;
  chapter?: number;
  verse?: number;
}

/** A word or verse the reader tapped: drives the little menu with meaning and play actions. */
export interface Pick {
  chapter: number;
  verse: number;
  /** 0 when the verse-end marker was tapped */
  pos: number;
}

/** Focus mode is switched off for now: set to true to bring back its button, shortcut and settings. */
export const FOCUS_MODE = false;

class Ui {
  settingsOpen = $state(false);
  area = $state<SettingsArea>('appearance');
  focus = $state(false);
  fullscreen = $state(false);
  /** In focus mode the player bar only shows while the pointer is active. */
  chromeVisible = $state(true);
  /** the listening bar is opt-in: it opens when the reader asks to hear something */
  listening = $state(false);
  pick = $state<Pick | null>(null);
  notice = $state<Notice | null>(null);
  /** sidebar tab */
  tab = $state<'surahs' | 'bookmarks'>('surahs');

  private idle = 0;

  openSettings(area?: SettingsArea) {
    if (area) this.area = area;
    this.settingsOpen = true;
  }
  closeSettings() {
    this.settingsOpen = false;
  }

  toggleListening() {
    this.listening = !this.listening;
  }

  /** the list lives beside the reader, so from Settings this returns to it with the list showing */
  toggleSidebar() {
    if (this.settingsOpen) {
      this.settingsOpen = false;
      settings.sidebar = true;
    } else settings.sidebar = !settings.sidebar;
  }
  toggleSettings() {
    this.settingsOpen = !this.settingsOpen;
  }

  async toggleFullscreen() {
    this.fullscreen = !this.fullscreen;
    await setFullscreen(this.fullscreen).catch(() => (this.fullscreen = !this.fullscreen));
  }

  async toggleFocus() {
    if (!FOCUS_MODE) return;
    this.focus = !this.focus;
    this.settingsOpen = false;
    this.chromeVisible = true;
    this.poke();
    if (this.focus !== this.fullscreen) await this.toggleFullscreen();
  }

  /** Called on pointer movement: show the chrome, then hide it again after a quiet moment. */
  poke() {
    this.chromeVisible = true;
    clearTimeout(this.idle);
    if (this.focus) this.idle = window.setTimeout(() => this.settle(), 2600);
  }
  /** Hide the chrome after a quiet moment, but never while the pointer is resting on it. */
  private settle() {
    if (document.querySelector('.bar:hover, .sub:hover, footer:hover, .rp-pop')) {
      this.idle = window.setTimeout(() => this.settle(), 1200);
      return;
    }
    this.chromeVisible = false;
  }

  async syncFullscreen() {
    this.fullscreen = await getFullscreen().catch(() => false);
  }
}

export const ui = new Ui();
