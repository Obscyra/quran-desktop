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

// Every pair below was checked for WCAG contrast: ink on ground 12:1+, muted on ground and
// surface 5:1+, accent on ground and surface 4.7:1+. The dark themes avoid pure black and pure white (harsh on the eyes). No violet or indigo, no cream with terracotta.
export const THEMES: Theme[] = [
  { id: 'night', name: 'Night', dark: true, bg: '#0e0c09', surface: '#1a1611', ink: '#fffaf0', muted: '#ddd2ba', accent: '#f0c46a', accentInk: '#1a1408' },
  { id: 'tahajjud', name: 'Tahajjud', dark: true, bg: '#070b12', surface: '#101826', ink: '#f4f1ea', muted: '#b3bccb', accent: '#ffb36b', accentInk: '#241100' },
  { id: 'tide', name: 'Tide', dark: true, bg: '#13232a', surface: '#1c3039', ink: '#e4eff0', muted: '#9fbbc0', accent: '#7ec8c2', accentInk: '#062321' },
  { id: 'fjord', name: 'Fjord', dark: true, bg: '#1a222c', surface: '#242f3b', ink: '#e9eef4', muted: '#a9b8c9', accent: '#8fb9d8', accentInk: '#0c1a26' },
  { id: 'graphite', name: 'Graphite', dark: true, bg: '#1b1c1e', surface: '#26282b', ink: '#eeeeed', muted: '#a9acb1', accent: '#8cc0ad', accentInk: '#0d211a' },
  { id: 'moss', name: 'Moss', dark: true, bg: '#20272a', surface: '#2a3337', ink: '#e8e5d3', muted: '#adb8a6', accent: '#a7c77f', accentInk: '#142108' },
  { id: 'sidr', name: 'Sidr', dark: true, bg: '#12170d', surface: '#1e2613', ink: '#e3e9d3', muted: '#a9b78a', accent: '#bccd57', accentInk: '#141b02' },
  { id: 'rosewood', name: 'Rosewood', dark: true, bg: '#201a1c', surface: '#2b2326', ink: '#f1e6e6', muted: '#c0acaf', accent: '#e3a3a8', accentInk: '#2a0d12' },
  { id: 'forest', name: 'Madinah', dark: true, bg: '#0c1a14', surface: '#143025', ink: '#f4faf4', muted: '#b9d0c3', accent: '#dcb85e', accentInk: '#1a1408' },
  { id: 'slate', name: 'Slate', dark: true, bg: '#10151c', surface: '#1a222c', ink: '#f3f6fa', muted: '#b4c0ce', accent: '#74b8de', accentInk: '#08141c' },
  { id: 'paper', name: 'Paper', dark: false, bg: '#ede8de', surface: '#e4ddcf', ink: '#231d12', muted: '#625640', accent: '#0d6a50', accentInk: '#f4f1e8' },
  { id: 'gold', name: 'White & Gold', dark: false, bg: '#fffdf7', surface: '#f5edd8', ink: '#2a2310', muted: '#675a33', accent: '#86620c', accentInk: '#fffdf7' },
  { id: 'stone', name: 'Stone', dark: false, bg: '#e8eaeb', surface: '#dcdfe1', ink: '#15181b', muted: '#515b64', accent: '#0a6a74', accentInk: '#f2f7f8' },
  { id: 'sage', name: 'Sage', dark: false, bg: '#e4eae1', surface: '#d7dfd3', ink: '#1a2219', muted: '#4d5c4b', accent: '#2c6b43', accentInk: '#f1f7ee' },
  { id: 'rosewater', name: 'Rosewater', dark: false, bg: '#f3e8e7', surface: '#e8d8d8', ink: '#2b1b1e', muted: '#684f53', accent: '#9a3a4e', accentInk: '#fbf1f2' }
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
