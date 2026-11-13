import { NextResponse } from 'next/server';
import { getCurrentCustomer, getCurrentAdmin } from '@/lib/auth';
import { putObject, storageConfigured } from '@/lib/storage';
import { rateLimit } from '@/lib/db';

export const runtime = 'nodejs';

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export async function POST(request) {
  const [customer, admin] = await Promise.all([getCurrentCustomer(), getCurrentAdmin()]);
  if (!customer && !admin) return NextResponse.json({ error: 'Sign in to upload images.' }, { status: 401 });
  const key = admin ? `admin:${admin.id}` : `customer:${customer.id}`;
  if (!rateLimit(`upload:${key}`, 30, 60_000).ok) {
    return NextResponse.json({ error: 'Too many uploads, slow down.' }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Use JPG, PNG, WebP or AVIF.' }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Max file size is 6MB.' }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const folder = admin ? (form.get('folder') || 'catalog') : 'reviews';
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');

  if (!storageConfigured()) {
    return NextResponse.json({
      error: 'Image storage is not configured. Set AWS_ENDPOINT_URL_S3 / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / S3_BUCKET.',
    }, { status: 503 });
  }
  try {
    const url = await putObject({ buffer, contentType: file.type, folder, ext });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: `Upload failed: ${e.message}` }, { status: 502 });
  }
}
