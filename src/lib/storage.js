import crypto from 'node:crypto';
import { AwsClient } from 'aws4fetch';

export function storageConfigured() {
  return Boolean(process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET);
}

function client() {
  return new AwsClient({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-2',
    service: 's3',
  });
}

const endpoint = () => process.env.AWS_ENDPOINT_URL_S3.replace(/\/$/, '');
const bucket = () => process.env.S3_BUCKET;

/** Public URL for an object. Neon object storage exposes objects on the bucket path. */
export function publicUrl(key) {
  return `${endpoint()}/${bucket()}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function putObject({ buffer, contentType, folder = 'catalog', ext = 'jpg' }) {
  const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const res = await client().fetch(publicUrl(key), {
    method: 'PUT',
    body: buffer,
    headers: { 'content-type': contentType, 'cache-control': 'public, max-age=31536000, immutable' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`storage responded ${res.status} ${text.slice(0, 160)}`);
  }
  return publicUrl(key);
}

export async function deleteObject(url) {
  const prefix = `${endpoint()}/${bucket()}/`;
  if (!url?.startsWith(prefix)) return { skipped: true };
  const key = url.slice(prefix.length);
  await client().fetch(`${endpoint()}/${bucket()}/${key}`, { method: 'DELETE' });
  return { deleted: true };
}

export async function listObjects(prefix = '') {
  const res = await client().fetch(`${endpoint()}/${bucket()}?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=100`);
  if (!res.ok) throw new Error(`storage list failed ${res.status}`);
  return res.text();
}
