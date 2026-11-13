'use client';
import { createContext, useContext, useCallback, useMemo, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getTheme } from '@/lib/themes';
import { fontStack } from '@/lib/typography';

const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);

export function applyPalette(slug, fonts) {
  const root = document.documentElement;
  const theme = getTheme(slug);
  theme.colors && Object.entries(theme.colors).forEach(([key, value]) => root.style.setProperty(`--${key.replace(/[A-Z0-9]/g, (m) => '-' + m.toLowerCase())}`, value));
  root.style.setProperty('--serif', fontStack(fonts?.heading || theme.font || 'Cormorant Garamond'));
  root.style.setProperty('--sans', fontStack(fonts?.body || 'Inter'));
  root.dataset.theme = theme.slug;
  root.dataset.mode = theme.mode;
  root.dataset.style = theme.style || 'editorial';
}

export function StoreProvider({ initial, children }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [, startTransition] = useTransition();
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  const setCartCount = useCallback((n) => setState((s) => ({ ...s, cartCount: Math.max(0, n) })), []);
  const setWishlistCount = useCallback((n) => setState((s) => ({ ...s, wishlistCount: Math.max(0, n) })), []);
  const patch = useCallback((p) => setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) })), []);

  const activeCurrency = useMemo(
    () => state.currencies.find((c) => c.code === state.currency) || state.currencies[0],
    [state.currencies, state.currency]
  );

  const money = useCallback(
    (minor) => {
      if (minor == null) return '';
      const cur = activeCurrency || { symbol: 'Rs', rate: 1, decimals: 0 };
      const major = Number(minor) / 100 / Number(cur.rate || 1);
      const d = cur.decimals ?? 2;
      return `${cur.symbol} ${major.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
    },
    [activeCurrency]
  );

  const setCurrency = useCallback(
    async (code) => {
      setState((s) => ({ ...s, currency: code }));
      try {
        localStorage.setItem('nova_currency', code);
        await fetch('/api/account/preferences', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currency: code }),
        });
      } catch { /* local only */ }
      router.refresh();
    },
    [router]
  );

  const setTheme = useCallback(
    async (slug) => {
      const targetSlug = slug || state.theme.defaultSlug || 'moonstone';
      const preset = getTheme(targetSlug);
      const nextFonts = state.theme.fontPersonal
        ? state.theme.fonts
        : (slug ? { heading: preset.font || 'Cormorant Garamond', body: 'Inter' } : state.theme.defaultFonts || { heading: preset.font || 'Cormorant Garamond', body: 'Inter' });
      applyPalette(targetSlug, nextFonts);
      setState((s) => ({ ...s, theme: { ...s.theme, slug: targetSlug, fonts: nextFonts, source: slug ? 'customer' : 'store' } }));
      try {
        localStorage.setItem('nova_theme', slug || '');
        await fetch('/api/account/preferences', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme_palette: slug || null }),
        });
      } catch (e) { console.error('Could not save theme preference', e); }
      router.refresh();
    },
    [router, state.theme]
  );

  const setFonts = useCallback(async (fonts, enabled = true) => {
    const next = { heading: fonts.heading, body: fonts.body };
    applyPalette(state.theme.slug, next);
    setState((s) => ({ ...s, theme: { ...s.theme, fonts: next, fontPersonal: enabled } }));
    try {
      localStorage.setItem('nova_fonts', JSON.stringify({ ...next, enabled }));
      await fetch('/api/account/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ font_preference: { ...next, enabled } }) });
    } catch (e) { console.error('Could not save typography preference', e); }
    router.refresh();
  }, [router, state.theme]);

  useEffect(() => {
    const nextTheme = initial?.theme;
    if (!nextTheme || state.theme.source === 'customer') return;
    applyPalette(nextTheme.slug, nextTheme.fonts);
    setState((s) => ({ ...s, theme: { ...s.theme, ...nextTheme } }));
  }, [initial?.theme?.slug, initial?.theme?.fonts?.heading, initial?.theme?.fonts?.body]); // eslint-disable-line

  useEffect(() => {
    if (state.customer) return;
    const saved = typeof window !== 'undefined' && localStorage.getItem('nova_currency');
    if (saved && state.currencies.some((c) => c.code === saved) && saved !== state.currency) {
      setState((s) => ({ ...s, currency: saved }));
    }
  }, [state.customer, state.currencies]); // eslint-disable-line

  const value = useMemo(
    () => ({ ...state, patch, refresh, setCartCount, setWishlistCount, money, setCurrency, setTheme, setFonts, activeCurrency }),
    [state, patch, refresh, setCartCount, setWishlistCount, money, setCurrency, setTheme, setFonts, activeCurrency]
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
