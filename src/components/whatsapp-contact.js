'use client';

import { useStore } from './providers';

export function WhatsAppContact() {
  const { store } = useStore();
  const phone = String(store?.whatsapp || '').replace(/\D/g, '');
  if (phone.length < 8 || phone.length > 15) return null;

  return (
    <a
      className="whatsapp-float"
      href={`https://wa.me/${phone}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
    >
      <span className="whatsapp-tooltip" role="tooltip">Chat with us</span>
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M16.02 3.2A12.65 12.65 0 0 0 5.13 22.28L3.4 28.6l6.47-1.7A12.64 12.64 0 1 0 16.02 3.2Zm0 22.96a10.3 10.3 0 0 1-5.25-1.44l-.38-.23-3.84 1.01 1.03-3.74-.25-.39a10.31 10.31 0 1 1 8.69 4.79Zm5.67-7.72c-.31-.15-1.82-.9-2.1-1-.28-.1-.49-.15-.69.16-.2.31-.79 1-.97 1.21-.18.2-.36.23-.67.08-.31-.15-1.3-.48-2.47-1.52-.91-.81-1.53-1.81-1.71-2.12-.18-.31-.02-.47.13-.62.14-.14.31-.36.46-.54.15-.18.2-.31.31-.51.1-.21.05-.39-.03-.54-.08-.15-.69-1.66-.95-2.27-.25-.59-.51-.51-.69-.52h-.59c-.21 0-.54.08-.82.39-.28.31-1.08 1.05-1.08 2.56s1.1 2.97 1.25 3.18c.15.2 2.16 3.3 5.24 4.63.73.31 1.3.5 1.74.64.73.23 1.4.2 1.93.12.59-.09 1.82-.74 2.08-1.46.25-.72.25-1.33.18-1.46-.08-.13-.28-.21-.59-.36Z" />
      </svg>
    </a>
  );
}
