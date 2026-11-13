import { getCurrentCustomer } from '@/lib/auth';
import { getCurrencies } from '@/lib/currency';
import { getThemeConfig } from '@/lib/theme-server';
import { AccountSettings } from '@/components/account-settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Account settings' };

export default async function SettingsPage() {
  const [customer, currencies, themeConfig] = await Promise.all([getCurrentCustomer(), getCurrencies(), getThemeConfig()]);
  if (!customer) return null;
  return (
    <AccountSettings
      customer={{ name: customer.name, email: customer.email, phone: customer.phone, avatar: customer.avatar_url, verified: customer.email_verified, currency: customer.currency, theme: customer.theme_palette }}
      currencies={currencies}
      themes={themeConfig.themes}
      allowOverride={themeConfig.allowOverride}
      storePalette={themeConfig.palette}
    />
  );
}
