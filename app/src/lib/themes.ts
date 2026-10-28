export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
}

// Every pair below was checked for WCAG contrast: ink on ground 13:1+, muted on ground and
// surface 5:1+, accent on ground and surface 4.7:1+. No violet or indigo, no cream with terracotta.
export const THEMES: Theme[] = [
  { id: 'night', name: 'Night', dark: true, bg: '#0e0c09', surface: '#1a1611', ink: '#fffaf0', muted: '#ddd2ba', accent: '#f0c46a', accentInk: '#1a1408' },
  { id: 'oled', name: 'Black', dark: true, bg: '#000000', surface: '#120e06', ink: '#fbf3dc', muted: '#d6c9a0', accent: '#d9ad3e', accentInk: '#120c00' },
  { id: 'forest', name: 'Madinah', dark: true, bg: '#0c1a14', surface: '#143025', ink: '#f4faf4', muted: '#b9d0c3', accent: '#dcb85e', accentInk: '#1a1408' },
  { id: 'slate', name: 'Slate', dark: true, bg: '#10151c', surface: '#1a222c', ink: '#f3f6fa', muted: '#b4c0ce', accent: '#74b8de', accentInk: '#08141c' },
  { id: 'paper', name: 'Paper', dark: false, bg: '#ede8de', surface: '#e4ddcf', ink: '#231d12', muted: '#625640', accent: '#0d6a50', accentInk: '#f4f1e8' },
  { id: 'gold', name: 'White & Gold', dark: false, bg: '#fffdf7', surface: '#f5edd8', ink: '#2a2310', muted: '#675a33', accent: '#86620c', accentInk: '#fffdf7' },
  { id: 'stone', name: 'Stone', dark: false, bg: '#e8eaeb', surface: '#dcdfe1', ink: '#15181b', muted: '#515b64', accent: '#0a6a74', accentInk: '#f2f7f8' }
];

export function resolveTheme(id: string, systemDark: boolean): Theme {
  if (id === 'auto') return THEMES.find((t) => t.id === (systemDark ? 'night' : 'paper'))!;
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(t: Theme) {
  const s = document.documentElement.style;
  s.setProperty('--bg', t.bg);
  s.setProperty('--surface', t.surface);
  s.setProperty('--ink', t.ink);
  s.setProperty('--muted', t.muted);
  s.setProperty('--accent', t.accent);
  s.setProperty('--accent-ink', t.accentInk);
  s.colorScheme = t.dark ? 'dark' : 'light';
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', t.bg);
}
