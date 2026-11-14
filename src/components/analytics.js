'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** First-party visitor analytics — one beacon per navigation, admin excluded. */
export function Analytics({ enabled }) {
  const pathname = usePathname();
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (pathname.startsWith('/admin')) return;
    const body = JSON.stringify({ path: pathname, referrer: document.referrer || '' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    }
  }, [pathname, enabled]);
  return null;
}
