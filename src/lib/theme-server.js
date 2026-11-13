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
    const list = await sql`select slug, name, description, swatch, is_active from themes order by position`.catch(() => []);
    const themes = (list.length ? list : THEMES.map((t) => ({ ...t, is_active: true }))).filter((t) => t.is_active !== false);
    return { palette, allowOverride, themes, theme: getTheme(palette) };
  });
}

export function resolveTheme(config, customer) {
  if (!customer || !config.allowOverride) return { slug: config.palette, source: 'store' };
  if (customer.theme_palette && THEMES.some((t) => t.slug === customer.theme_palette)) {
    return { slug: customer.theme_palette, source: 'customer' };
  }
  return { slug: config.palette, source: 'store' };
}
