'use client';
import { createContext, useContext, useCallback, useMemo, useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);

const PALETTES = {
  moonstone: { bg:'#f7f2ea',surface:'#fffdf8',surface2:'#efe7db',ink:'#16130f',muted:'#6d6459',line:'#dfd4c4',accent:'#b08d4f',accentSoft:'#e8dcc6',accentInk:'#fffdf8',glow:'rgba(176,141,79,.18)' },
  obsidian: { bg:'#0d0f12',surface:'#15181d',surface2:'#1d2127',ink:'#f6f1e7',muted:'#a49b8c',line:'#2a2f36',accent:'#d9b978',accentSoft:'#2b2416',accentInk:'#12100b',glow:'rgba(217,185,120,.22)' },
  rosewater: { bg:'#fbf4f2',surface:'#fffaf8',surface2:'#f4e6e2',ink:'#331f1b',muted:'#82615a',line:'#ead4ce',accent:'#c0786a',accentSoft:'#f3ded8',accentInk:'#fffaf8',glow:'rgba(192,120,106,.2)' },
  emerald: { bg:'#0f1c18',surface:'#152621',surface2:'#1c312a',ink:'#eef2ea',muted:'#9fb1a3',line:'#27403a',accent:'#c2a86b',accentSoft:'#24352a',accentInk:'#0f1c18',glow:'rgba(194,168,107,.2)' },
  porcelain: { bg:'#f6f7f9',surface:'#ffffff',surface2:'#eceff3',ink:'#12151a',muted:'#5e6a78',line:'#dbe1e8',accent:'#40536b',accentSoft:'#e2e8ef',accentInk:'#ffffff',glow:'rgba(64,83,107,.16)' },
  saffron: { bg:'#fdf6ec',surface:'#fffcf6',surface2:'#f6e9d6',ink:'#2b1c12',muted:'#7b6450',line:'#e9d7bf',accent:'#b45f2c',accentSoft:'#f2dfc8',accentInk:'#fffcf6',glow:'rgba(180,95,44,.18)' },
};
export function applyPalette(slug) {
  const p = PALETTES[slug] || PALETTES.moonstone;
  const root = document.documentElement;
  Object.entries(p).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
  root.dataset.mode = ['obsidian', 'emerald'].includes(slug) ? 'dark' : 'light';
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
      if (slug) { document.documentElement.dataset.theme = slug; applyPalette(slug); }
      setState((s) => ({ ...s, theme: { ...s.theme, slug: slug || s.theme.slug, source: slug ? 'customer' : 'store' } }));
      try {
        localStorage.setItem('nova_theme', slug || '');
        await fetch('/api/account/preferences', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme_palette: slug || null }),
        });
      } catch { /* guest: local only */ }
      router.refresh();
    },
    [router]
  );

  useEffect(() => {
    if (state.customer) return;
    const saved = typeof window !== 'undefined' && localStorage.getItem('nova_currency');
    if (saved && state.currencies.some((c) => c.code === saved) && saved !== state.currency) {
      setState((s) => ({ ...s, currency: saved }));
    }
  }, [state.customer, state.currencies]); // eslint-disable-line

  const value = useMemo(
    () => ({ ...state, patch, refresh, setCartCount, setWishlistCount, money, setCurrency, setTheme, activeCurrency }),
    [state, patch, refresh, setCartCount, setWishlistCount, money, setCurrency, setTheme, activeCurrency]
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
