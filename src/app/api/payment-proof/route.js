import { NextResponse } from 'next/server';
import { getCurrentCustomer } from '@/lib/auth';
import { putPrivateObject, storageConfigured } from '@/lib/storage';
import { rateLimit } from '@/lib/db';

export const runtime = 'nodejs';
// Keep multipart uploads under the Vercel serverless request-body limit.
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
function valid(type, b) {
  if (type === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === 'image/png') return b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === 'image/webp') return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  return type === 'application/pdf' && b.subarray(0, 5).toString() === '%PDF-';
}
export async function POST(request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in to submit payment proof.' }, { status: 401 });
  if (!storageConfigured()) return NextResponse.json({ error: 'Private file storage is not configured.' }, { status: 503 });
  if (!rateLimit(`payment-proof:${customer.id}`, 10, 60_000).ok) return NextResponse.json({ error: 'Too many uploads. Try again shortly.' }, { status: 429 });
  const announcedLength = Number(request.headers.get('content-length') || 0);
  if (announcedLength > MAX_BYTES + 128 * 1024) return NextResponse.json({ error: 'Payment proof must be no larger than 4 MB.' }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Choose a receipt image or PDF.' }, { status: 400 });
  if (!TYPES.has(file.type)) return NextResponse.json({ error: 'Use JPG, PNG, WebP, or PDF.' }, { status: 415 });
  if (!file.size || file.size > MAX_BYTES) return NextResponse.json({ error: 'Payment proof must be between 1 byte and 4 MB.' }, { status: 413 });
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!valid(file.type, buffer)) return NextResponse.json({ error: 'The file contents do not match the selected type.' }, { status: 415 });
  try {
    const key = await putPrivateObject({ buffer, contentType: file.type, folder: `payment-proofs/customer-${customer.id}`, ext: file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1].replace('jpeg', 'jpg') });
    return NextResponse.json({ ok: true, proofKey: key });
  } catch (error) {
    console.error('Payment proof upload failed:', { status: error?.status || null, storageCode: error?.storageCode || null, cause: error?.cause?.code || null });
    return NextResponse.json({ error: 'Secure proof upload failed. Please retry or contact support.' }, { status: 502 });
  }
}
