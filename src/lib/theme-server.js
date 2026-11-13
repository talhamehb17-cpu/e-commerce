import { sql, cached } from './db.js';
import { THEMES, DEFAULT_THEME, getTheme } from './themes.js';

/**
 * Resolution order for the theme applied to a visitor:
 * 1. Signed-in customer's personal override (stored on their account)
 * 2. Admin-configured store default
 * 3. Built-in fallback
 */
export async function getThemeConfig() {
  return cached('theme-config', 15_000, async () => {
    let palette = DEFAULT_THEME;
    let allowOverride = true;
    try {
      const rows = await sql`select value from settings where key = 'theme' limit 1`;
      const v = rows[0]?.value || {};
      if (v.palette && THEMES.some((t) => t.slug === v.palette)) palette = v.palette;
      if (v.allow_customer_override === false) allowOverride = false;
    } catch {
      /* defaults */
    }
    const list = await sql`select slug, is_active from themes order by position`.catch(() => []);
    const active = list.length ? new Set(list.filter((t) => t.is_active).map((t) => t.slug)) : null;
    const themes = THEMES.filter((t) => !active || active.has(t.slug));
    const row = await sql`select value from settings where key='theme' limit 1`.catch(() => []);
    const fonts = row[0]?.value?.fonts || null;
    const allowFontOverride = row[0]?.value?.allow_customer_font_override !== false;
    return { palette, allowOverride, allowFontOverride, fonts, themes, theme: getTheme(palette) };
  });
}

export function resolveTheme(config, customer) {
  const personalFonts = customer && config.allowFontOverride && customer.font_preference?.enabled ? customer.font_preference : null;
  if (!customer || !config.allowOverride || !customer.theme_palette || !THEMES.some((t) => t.slug === customer.theme_palette)) {
    return { slug: config.palette, source: 'store', fonts: personalFonts || config.fonts };
  }
  return { slug: customer.theme_palette, source: 'customer', fonts: personalFonts || null };
}
