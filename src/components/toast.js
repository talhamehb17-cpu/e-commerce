'use client';
import { useEffect, useState } from 'react';

export function toast(message, kind = 'ok') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('nova:toast', { detail: { message, kind } }));
}

export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const handler = (e) => {
      const id = Math.random().toString(36).slice(2);
      setItems((s) => [...s, { id, ...e.detail }]);
      setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 3200);
    };
    window.addEventListener('nova:toast', handler);
    return () => window.removeEventListener('nova:toast', handler);
  }, []);
  return items.map((i, idx) => (
    <div key={i.id} className="toast" data-show="true" data-kind={i.kind} style={{ bottom: 26 + idx * 54 }}>
      {i.message}
    </div>
  ));
}
