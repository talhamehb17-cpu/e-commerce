/**
 * Theme palettes. Every palette is applied by setting CSS variables on <html>.
 * Admin picks the store default; a signed-in customer may pick a personal
 * override which is stored on their account (never globally).
 */
export const THEMES = [
  {
    slug: 'moonstone',
    name: 'Moonstone',
    description: 'Warm ivory, soft gold and deep ink — the signature NOVA look.',
    swatch: ['#f7f2ea', '#c8a96a', '#16130f'],
    mode: 'light',
    colors: {
      bg: '#f7f2ea',
      surface: '#fffdf8',
      surface2: '#efe7db',
      ink: '#16130f',
      muted: '#6d6459',
      line: '#dfd4c4',
      accent: '#b08d4f',
      accentSoft: '#e8dcc6',
      accentInk: '#fffdf8',
      glow: 'rgba(176,141,79,.18)',
    },
  },
  {
    slug: 'obsidian',
    name: 'Obsidian Gold',
    description: 'Midnight backdrop with champagne metal. Dramatic and editorial.',
    swatch: ['#0d0f12', '#d9b978', '#f4efe6'],
    mode: 'dark',
    colors: {
      bg: '#0d0f12',
      surface: '#15181d',
      surface2: '#1d2127',
      ink: '#f6f1e7',
      muted: '#a49b8c',
      line: '#2a2f36',
      accent: '#d9b978',
      accentSoft: '#2b2416',
      accentInk: '#12100b',
      glow: 'rgba(217,185,120,.22)',
    },
  },
  {
    slug: 'rosewater',
    name: 'Rosewater',
    description: 'Blush, pearl and dusty rose for a softer romantic mood.',
    swatch: ['#fbf4f2', '#c98b7d', '#3a2420'],
    mode: 'light',
    colors: {
      bg: '#fbf4f2',
      surface: '#fffaf8',
      surface2: '#f4e6e2',
      ink: '#331f1b',
      muted: '#82615a',
      line: '#ead4ce',
      accent: '#c0786a',
      accentSoft: '#f3ded8',
      accentInk: '#fffaf8',
      glow: 'rgba(192,120,106,.2)',
    },
  },
  {
    slug: 'emerald',
    name: 'Emerald Court',
    description: 'Deep forest green with antique brass — heritage luxury.',
    swatch: ['#0f1c18', '#c2a86b', '#eef2ea'],
    mode: 'dark',
    colors: {
      bg: '#0f1c18',
      surface: '#152621',
      surface2: '#1c312a',
      ink: '#eef2ea',
      muted: '#9fb1a3',
      line: '#27403a',
      accent: '#c2a86b',
      accentSoft: '#24352a',
      accentInk: '#0f1c18',
      glow: 'rgba(194,168,107,.2)',
    },
  },
  {
    slug: 'porcelain',
    name: 'Porcelain',
    description: 'Cool gallery white with graphite and a whisper of blue.',
    swatch: ['#f6f7f9', '#3c4a5a', '#12151a'],
    mode: 'light',
    colors: {
      bg: '#f6f7f9',
      surface: '#ffffff',
      surface2: '#eceff3',
      ink: '#12151a',
      muted: '#5e6a78',
      line: '#dbe1e8',
      accent: '#40536b',
      accentSoft: '#e2e8ef',
      accentInk: '#ffffff',
      glow: 'rgba(64,83,107,.16)',
    },
  },
  {
    slug: 'saffron',
    name: 'Saffron Dusk',
    description: 'Terracotta, saffron and clay — warm and earthy.',
    swatch: ['#fdf6ec', '#c2703a', '#2b1c12'],
    mode: 'light',
    colors: {
      bg: '#fdf6ec',
      surface: '#fffcf6',
      surface2: '#f6e9d6',
      ink: '#2b1c12',
      muted: '#7b6450',
      line: '#e9d7bf',
      accent: '#b45f2c',
      accentSoft: '#f2dfc8',
      accentInk: '#fffcf6',
      glow: 'rgba(180,95,44,.18)',
    },
  },
];

export const DEFAULT_THEME = 'moonstone';

export function getTheme(slug) {
  return THEMES.find((t) => t.slug === slug) || THEMES[0];
}

export function themeCssVars(theme) {
  const t = getTheme(theme);
  return Object.entries(t.colors)
    .map(([k, v]) => `--${k.replace(/[A-Z0-9]/g, (m) => '-' + m.toLowerCase())}:${v}`)
    .join(';');
}
