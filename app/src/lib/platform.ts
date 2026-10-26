export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function setFullscreen(on: boolean) {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setFullscreen(on);
  } else if (on) {
    await document.documentElement.requestFullscreen?.();
  } else if (document.fullscreenElement) {
    await document.exitFullscreen();
  }
}

export async function getFullscreen(): Promise<boolean> {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow().isFullscreen();
  }
  return !!document.fullscreenElement;
}

export type Os = 'windows' | 'mac' | 'linux' | 'web';

/** `?os=windows` lets the native chrome be previewed in a plain browser. */
export function detectOs(): Os {
  const forced = new URLSearchParams(location.search).get('os');
  if (forced === 'windows' || forced === 'mac' || forced === 'linux') return forced;
  if (!isTauri()) return 'web';
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'windows';
  if (ua.includes('Mac')) return 'mac';
  return 'linux';
}

async function appWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}
export const winMinimize = async () => (await appWindow()).minimize();
export const winToggleMaximize = async () => (await appWindow()).toggleMaximize();
/** Close the window; if that is ever refused or stalls, quit the process so the app cannot get stuck open. */
export async function winClose() {
  try {
    const w = await appWindow();
    await Promise.race([w.close(), new Promise((_, no) => setTimeout(() => no(new Error('close timed out')), 4000))]);
  } catch {
    const { exit } = await import('@tauri-apps/plugin-process');
    await exit(0);
  }
}
export const winIsMaximized = async () => (await appWindow()).isMaximized();
export async function onWindowResized(cb: () => void): Promise<() => void> {
  return (await appWindow()).onResized(cb);
}
