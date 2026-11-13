/** Built-in visual systems. Applied as CSS variables on <html>; no runtime font requests. */
import { DEFAULT_FONTS, fontStack } from './typography.js';

const make = (slug, name, description, colors, mode = 'light', style = 'editorial', font = 'Cormorant Garamond') => ({
  slug, name, description, mode, style, font,
  swatch: [colors.accent, colors.accentSoft, colors.bg, colors.ink, colors.surface],
  colors,
});
const c = (bg, surface, surface2, ink, muted, line, accent, accentSoft, accentInk, glow) => ({ bg, surface, surface2, ink, muted, line, accent, accentSoft, accentInk, glow });

export const THEMES = [
  make('moonstone','Moonstone','Warm ivory, soft gold and deep ink — the signature NOVA look.',c('#f7f2ea','#fffdf8','#efe7db','#16130f','#6d6459','#dfd4c4','#b08d4f','#e8dcc6','#fffdf8','rgba(176,141,79,.18)'),'light','editorial','Cormorant Garamond'),
  make('obsidian','Midnight Luxury','Midnight surfaces, champagne metal and editorial contrast.',c('#0d0f12','#15181d','#1d2127','#f6f1e7','#a49b8c','#2a2f36','#d9b978','#2b2416','#12100b','rgba(217,185,120,.22)'),'dark','luxury','Cormorant Garamond'),
  make('rosewater','Rose Gold','Blush pearl, rose metal and soft romantic surfaces.',c('#fbf4f2','#fffaf8','#f4e6e2','#331f1b','#82615a','#ead4ce','#c0786a','#f3ded8','#fffaf8','rgba(192,120,106,.2)'),'light','boutique','Playfair Display'),
  make('emerald','Emerald Green','Deep evergreen with antique brass — heritage luxury.',c('#0f1c18','#152621','#1c312a','#eef2ea','#9fb1a3','#27403a','#c2a86b','#24352a','#0f1c18','rgba(194,168,107,.2)'),'dark','organic','Cormorant Garamond'),
  make('porcelain','Minimal White','Gallery white with graphite, cool blue and crisp lines.',c('#f6f7f9','#ffffff','#eceff3','#12151a','#5e6a78','#dbe1e8','#40536b','#e2e8ef','#ffffff','rgba(64,83,107,.16)'),'light','minimal','Inter'),
  make('saffron','Warm Sand','Terracotta, saffron and clay — warm and grounded.',c('#fdf6ec','#fffcf6','#f6e9d6','#2b1c12','#7b6450','#e9d7bf','#b45f2c','#f2dfc8','#fffcf6','rgba(180,95,44,.18)'),'light','organic','Lora'),
  make('ocean','Ocean Blue','Abyssal blue, sea-glass surfaces and a bright tide accent.',c('#edf5f8','#fbfeff','#dcecf1','#122b3b','#547080','#c8dce4','#167c9b','#d4edf4','#ffffff','rgba(22,124,155,.18)'),'light','clean','Manrope'),
  make('royal','Royal Purple','Regal violet, pale lilac and polished silver.',c('#f4f0f8','#fdfaff','#e9e0f2','#251a35','#71647e','#d9cce5','#7447a8','#e9dcf6','#ffffff','rgba(116,71,168,.2)'),'light','classic','Playfair Display'),
  make('sunset','Sunset Orange','Sun-washed apricot and vivid persimmon with warm ink.',c('#fff5ec','#fffdfa','#ffe5d1','#352016','#87634f','#f0d2bc','#e56b35','#ffe0cc','#ffffff','rgba(229,107,53,.18)'),'light','bold','DM Sans'),
  make('champagne','Champagne','Pale champagne, cream and quiet brushed gold.',c('#f8f4eb','#fffdf7','#eee6d4','#2c281f','#777062','#ded5c2','#a9843f','#eee2c8','#fffdf7','rgba(169,132,63,.16)'),'light','luxury','Cormorant Garamond'),
  make('slate','Modern Slate','Architectural slate, cloud white and electric teal.',c('#edf0f2','#ffffff','#dfe4e7','#202a30','#65747b','#d0d8dc','#247d82','#d5eceb','#ffffff','rgba(36,125,130,.16)'),'light','minimal','Manrope'),
  make('cyber','Cyber Neon','Ink-dark canvas with acid lime and ultraviolet glow.',c('#101016','#191922','#242431','#f4f2ff','#aaa7bf','#393847','#b7f34a','#303922','#171b0d','rgba(183,243,74,.22)'),'dark','neon','Outfit'),
  make('forest','Forest Green','Moss, fern and linen — a calm natural palette.',c('#eef2e9','#fbfdf7','#dfe8d7','#243022','#687562','#d0dcc8','#4e7443','#dce9d3','#ffffff','rgba(78,116,67,.16)'),'light','organic','Lora'),
  make('burgundy','Burgundy','Wine velvet, parchment and a restrained rose accent.',c('#24171b','#302126','#3c2a30','#f8eff0','#bda9ae','#503941','#b65d72','#4b2d37','#fff7f8','rgba(182,93,114,.2)'),'dark','luxury','Playfair Display'),
  make('arctic','Arctic Frost','Glacial blue, frosted surfaces and crisp cobalt.',c('#eff7fb','#ffffff','#deedf5','#142a3d','#637b8c','#cddfe9','#3985b8','#dceefa','#ffffff','rgba(57,133,184,.18)'),'light','glass','Inter'),
  make('monochrome','Contemporary Monochrome','Pure black, white and precise grayscale hierarchy.',c('#f4f4f4','#ffffff','#e7e7e7','#111111','#686868','#d5d5d5','#222222','#dddddd','#ffffff','rgba(20,20,20,.12)'),'light','mono','Inter'),
  make('scandinavian','Scandinavian Minimal','Pine, oat and chalk with airy Scandinavian restraint.',c('#f5f4ee','#fffefa','#e9e8dc','#26302b','#69736b','#d9dacf','#557363','#dce7de','#ffffff','rgba(85,115,99,.15)'),'light','minimal','Manrope'),
  make('pastel','Soft Pastel','Lilac, mint and cream — playful but considered.',c('#f7f1f7','#fffaff','#eee4ef','#33283a','#766b7b','#e1d5e4','#9b6ca8','#efe1f2','#ffffff','rgba(155,108,168,.17)'),'light','soft','Nunito'),
  make('gradient','Modern Gradient','Deep indigo and luminous orchid with layered depth.',c('#17162a','#211f39','#302c4e','#f7f4ff','#b8b2d0','#45405f','#9a74ed','#3b315c','#ffffff','rgba(154,116,237,.25)'),'dark','gradient','Outfit'),
  make('aurora','Aurora Glow','Northern-night navy, mint light and glacial cyan.',c('#101b25','#172733','#203642','#eaf7f4','#9db7b7','#2b444f','#62d7c4','#203d3d','#0b201f','rgba(98,215,196,.2)'),'dark','glass','Manrope'),
  make('warm-earth','Warm Earth','Clay, olive and sandstone with artisanal warmth.',c('#f3eee4','#fcf9f2','#e8decc','#30271d','#786b5b','#d7c9b3','#876344','#e8dac5','#fffdf9','rgba(135,99,68,.17)'),'light','organic','Lora'),
  make('clean-commerce','Clean Commerce','Bright, fast, legible — a modern commerce workhorse.',c('#f5f7fa','#ffffff','#e9edf2','#17212b','#657282','#d9e0e8','#2857a4','#dce7f8','#ffffff','rgba(40,87,164,.16)'),'light','clean','Inter'),
];

export const DEFAULT_THEME = 'moonstone';
export const getTheme = (slug) => THEMES.find((theme) => theme.slug === slug) || THEMES[0];
export function themeCssVars(theme, fonts = DEFAULT_FONTS) {
  const t = typeof theme === 'string' ? getTheme(theme) : theme;
  const colors = Object.entries(t.colors).map(([key, value]) => `--${key.replace(/[A-Z0-9]/g, (m) => '-' + m.toLowerCase())}:${value}`);
  const heading = fonts?.heading || t.font || DEFAULT_FONTS.heading;
  const body = fonts?.body || DEFAULT_FONTS.body;
  colors.push(`--serif:${fontStack(heading)}`, `--sans:${fontStack(body)}`);
  return colors.join(';');
}
