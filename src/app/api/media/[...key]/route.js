import { NextResponse } from 'next/server';
import { getObject, storageConfigured } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

export async function GET(_request, { params }) {
  const { key: segments = [] } = await params;
  const key = segments.join('/');
  // Only serve generated catalog/review image keys, never arbitrary bucket objects.
  if (!/^(?:catalog|reviews)\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{16}\.(?:jpe?g|png|webp|avif)$/i.test(key)) {
    return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  }
  if (!storageConfigured()) return NextResponse.json({ error: 'Image storage is unavailable.' }, { status: 503 });

  try {
    const storageResponse = await getObject(key);
    if (storageResponse.status === 404) return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    if (!storageResponse.ok) {
      console.error('Stored image read failed:', { status: storageResponse.status });
      return NextResponse.json({ error: 'Image could not be loaded.' }, { status: 502 });
    }
    const ext = key.split('.').pop().toLowerCase();
    const headers = new Headers({
      'Content-Type': storageResponse.headers.get('content-type') || CONTENT_TYPES[ext],
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    const length = storageResponse.headers.get('content-length');
    if (length) headers.set('Content-Length', length);
    return new Response(storageResponse.body, { status: 200, headers });
  } catch (error) {
    console.error('Stored image read failed:', { name: error?.name || 'Error' });
    return NextResponse.json({ error: 'Image could not be loaded.' }, { status: 502 });
  }
}
