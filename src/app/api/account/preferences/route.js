import { sql } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getCurrentCustomer } from '@/lib/auth';
import { z } from 'zod';
import { invalidate } from '@/lib/db';
import { THEMES } from '@/lib/themes';
import { getSetting } from '@/lib/settings';
import { FONT_OPTIONS } from '@/lib/typography';

const schema = z.object({
  currency: z.string().trim().length(3).optional(),
  theme_palette: z.string().trim().max(40).nullable().optional(),
  font_preference: z.object({ enabled: z.boolean(), heading: z.string(), body: z.string() }).optional(),
});

export async function POST(request) {
  const customer = await getCurrentCustomer();
  let body;
  try { body = await request.json(); } catch { return fail('Invalid body', 400); }
  if (!customer) return ok({ guest: true });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail('Invalid preferences', 422);
  const d = parsed.data;
  if (d.theme_palette && !THEMES.some((t) => t.slug === d.theme_palette)) return fail('Unknown theme.', 422);
  const fontNames = new Set(FONT_OPTIONS.map(([name]) => name));
  if (d.font_preference && (!fontNames.has(d.font_preference.heading) || !fontNames.has(d.font_preference.body))) return fail('Choose a supported font.', 422);
  const themeSettings = await getSetting('theme');
  if ((d.theme_palette !== undefined && themeSettings.allow_customer_override === false)
      || (d.font_preference && themeSettings.allow_customer_font_override === false)) return fail('Personal appearance choices are disabled by the store.', 403);

  if (parsed.data.currency) {
    const rows = await sql`select code from currencies where code = ${parsed.data.currency} and is_active`;
    if (!rows[0]) return fail('Unsupported currency', 400);
    await sql`update customers set currency = ${parsed.data.currency}, updated_at = now() where id = ${customer.id}`;
  }
  if (d.theme_palette !== undefined) {
    await sql`update customers set theme_palette = ${d.theme_palette || null}, updated_at = now() where id = ${customer.id}`;
  }
  if (d.font_preference) {
    await sql`update customers set font_preference = ${sql.json(d.font_preference)}, updated_at=now() where id=${customer.id}`;
  }
  invalidate('theme');
  return ok({ saved: true });
}
