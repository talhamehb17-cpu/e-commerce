import './globals.css';
import { cookies } from 'next/headers';
import { getCurrentCustomer, CART_COOKIE } from '@/lib/auth';
import { getThemeConfig, resolveTheme } from '@/lib/theme-server';
import { getCurrencies } from '@/lib/currency';
import { getSetting } from '@/lib/settings';
import { getTheme, themeCssVars } from '@/lib/themes';
import { sql } from '@/lib/db';
import { StoreProvider } from '@/components/providers';
import { ToastHost } from '@/components/toast';
import { Analytics } from '@/components/analytics';
import { SeasonalEffects } from '@/components/seasonal-effects';
import { PromotionPopups } from '@/components/promotion-popups';

export const metadata = {
  title: { default: 'NOVA — Everything, considered.', template: '%s · NOVA' },
  description:
    'A multi-category store for electronics, fashion, home, beauty, sport and everyday carry — chosen by hand, shipped worldwide.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: { title: 'NOVA', description: 'Everything, considered.', images: ['/images/hero/hero-main.jpg'] },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f2ea',
};

async function getCatalogueMeta() {
  try {
    const [categories, collections, brands] = await Promise.all([
      sql`select slug, name from categories where is_active order by position`,
      sql`select slug, name from collections where is_active order by position`,
      sql`select slug, name from brands where is_active order by position limit 8`,
    ]);
    return { categories, collections, brands };
  } catch {
    return { categories: [], collections: [], brands: [] };
  }
}

export default async function RootLayout({ children }) {
  const [customer, themeConfig, currencies, store, seasonal, promotions] = await Promise.all([
    getCurrentCustomer(),
    getThemeConfig(),
    getCurrencies(),
    getSetting('store'),
    getSetting('seasonal'),
    getSetting('promotions'),
  ]);
  const resolved = resolveTheme(themeConfig, customer);
  const theme = getTheme(resolved.slug);

  let cartCount = 0;
  let wishlistCount = 0;
  try {
    const token = (await cookies()).get(CART_COOKIE)?.value;
    if (token) {
      const rows = await sql`select coalesce(sum(qty),0)::int n from cart_items ci join carts c on c.id = ci.cart_id where c.token = ${token}`;
      cartCount = rows[0]?.n || 0;
    }
    if (customer) {
      const w = await sql`select count(*)::int n from wishlists where customer_id = ${customer.id}`;
      wishlistCount = w[0]?.n || 0;
    }
  } catch { /* ignore */ }

  const meta = await getCatalogueMeta();
  const defaultCurrency = currencies.find((c) => c.isDefault)?.code || 'PKR';
  const now = Date.now();
  const announcementStart = store.announcement_starts_at ? Date.parse(`${store.announcement_starts_at.slice(0, 10)}T00:00:00Z`) : null;
  const announcementEnd = store.announcement_ends_at ? Date.parse(`${store.announcement_ends_at.slice(0, 10)}T23:59:59.999Z`) : null;
  const announcement = (!announcementStart || now >= announcementStart) && (!announcementEnd || now <= announcementEnd) ? store.announcement : '';

  return (
    <html lang="en" data-theme={theme.slug} data-mode={theme.mode} data-style={theme.style || 'editorial'} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `:root{${themeCssVars(theme, resolved.fonts)}}` }} />
        <link rel="preload" href="/images/fonts/cormorant-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/images/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <StoreProvider
          initial={{
            customer: customer ? { id: customer.id, name: customer.name, email: customer.email, avatar: customer.avatar_url, verified: customer.email_verified } : null,
            cartCount,
            wishlistCount,
            currency: customer?.currency || defaultCurrency,
            currencies,
            theme: { slug: theme.slug, source: resolved.source, allowOverride: themeConfig.allowOverride, allowFontOverride: themeConfig.allowFontOverride, fonts: resolved.fonts || { heading: theme.font, body: 'Inter' }, fontPersonal: Boolean(customer?.font_preference?.enabled && themeConfig.allowFontOverride), defaultSlug: themeConfig.palette, defaultFonts: themeConfig.fonts || { heading: getTheme(themeConfig.palette).font, body: 'Inter' }, themes: themeConfig.themes },
            store: { name: store.name, tagline: store.tagline, announcement, instagram: store.instagram, facebook: store.facebook, email: store.email },
            catalogMeta: meta,
          }}
        >
          {children}
          <SeasonalEffects config={seasonal} />
          <PromotionPopups popups={promotions.popups || []} />
          <ToastHost />
          <Analytics enabled />
        </StoreProvider>
      </body>
    </html>
  );
}
