import { NextResponse } from 'next/server';
import { getCurrentCustomer, getCurrentAdmin, can } from '@/lib/auth';
import { putObject, storageConfigured } from '@/lib/storage';
import { rateLimit } from '@/lib/db';

export const runtime = 'nodejs';

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
function validImageSignature(type, b) {
  if (type === 'image/jpeg') return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === 'image/png') return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === 'image/webp') return b.length >= 12 && b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP';
  if (type === 'image/avif') return b.length >= 12 && b.toString('ascii',4,8) === 'ftyp' && ['avif','avis'].includes(b.toString('ascii',8,12));
  return false;
}

export async function POST(request) {
  const [customer, admin] = await Promise.all([getCurrentCustomer(), getCurrentAdmin()]);
  if (!customer && !admin) return NextResponse.json({ error: 'Sign in to upload images.' }, { status: 401 });
  if (admin && !can(admin, 'products:write')) return NextResponse.json({ error: 'Not permitted to upload catalog images.' }, { status: 403 });
  const announcedLength = Number(request.headers.get('content-length') || 0);
  if (announcedLength > MAX_BYTES + 64 * 1024) return NextResponse.json({ error: 'Max file size is 6MB.' }, { status: 413 });
  const key = admin ? `admin:${admin.id}` : `customer:${customer.id}`;
  if (!rateLimit(`upload:${key}`, 30, 60_000).ok) {
    return NextResponse.json({ error: 'Too many uploads, slow down.' }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Use JPG, PNG, WebP or AVIF.' }, { status: 415 });
  if (!file.size) return NextResponse.json({ error: 'Choose a non-empty image file.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Max file size is 6MB.' }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validImageSignature(file.type, buffer)) return NextResponse.json({ error: 'The file contents do not match the selected image type.' }, { status: 415 });
  const folder = admin ? 'catalog' : 'reviews';
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');

  if (!storageConfigured()) {
    return NextResponse.json({
      error: 'Image storage is not configured. Set AWS_ENDPOINT_URL_S3 / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / S3_BUCKET.',
    }, { status: 503 });
  }
  try {
    const url = await putObject({ buffer, contentType: file.type, folder, ext });
    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ error: 'Upload failed. Check storage configuration and try again.' }, { status: 502 });
  }
}
