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
const bucketUrl = () => `${endpoint()}/${bucket()}`;
const objectUrl = (key) => `${bucketUrl()}/${key.split('/').map(encodeURIComponent).join('/')}`;

function makeStorageError(operation, response, body = '') {
  const code = body.match(/<(?:\w+:)?Code>([^<]+)</i)?.[1] || null;
  const error = new Error(`${operation} returned HTTP ${response.status}${code ? ` (${code})` : ''}`);
  error.status = response.status;
  error.storageCode = code;
  return error;
}

async function throwResponseError(operation, response) {
  const body = await response.text().catch(() => '');
  throw makeStorageError(operation, response, body);
}

/**
 * Public-facing URL for an object. The bucket stays private; the same-origin
 * media route signs reads on the server, so public pages never need storage keys.
 */
export function publicUrl(key) {
  const path = `/api/media/${key.split('/').map(encodeURIComponent).join('/')}`;
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  return configuredOrigin ? `${configuredOrigin.replace(/\/$/, '')}${path}` : path;
}

async function createBucketIfMissing() {
  const response = await client().fetch(bucketUrl(), { method: 'PUT' });
  if (response.ok) return;
  const body = await response.text().catch(() => '');
  const code = body.match(/<(?:\w+:)?Code>([^<]+)</i)?.[1] || null;
  // Concurrent requests may both observe NoSuchBucket; the winner creates it.
  if (response.status === 409 && code === 'BucketAlreadyOwnedByYou') return;
  throw makeStorageError('Bucket creation', response, body);
}

async function putBytes({ buffer, contentType, folder, ext, isPrivate }) {
  const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomBytes(isPrivate ? 16 : 8).toString('hex')}.${ext}`;
  const upload = () => client().fetch(objectUrl(key), {
    method: 'PUT', body: buffer,
    headers: { 'content-type': contentType, 'cache-control': isPrivate ? 'private, no-store' : 'public, max-age=31536000, immutable' },
  });
  let res = await upload();
  if (res.status === 404) {
    const body = await res.text().catch(() => '');
    const code = body.match(/<(?:\w+:)?Code>([^<]+)</i)?.[1] || null;
    if (code !== 'NoSuchBucket') throw makeStorageError(isPrivate ? 'Private file upload' : 'Image upload', new Response(null, { status: res.status }), body);
    await createBucketIfMissing();
    res = await upload();
  }
  if (!res.ok) await throwResponseError(isPrivate ? 'Private file upload' : 'Image upload', res);
  return key;
}

export async function putObject({ buffer, contentType, folder = 'catalog', ext = 'jpg' }) {
  return publicUrl(await putBytes({ buffer, contentType, folder, ext, isPrivate: false }));
}

export async function putPrivateObject({ buffer, contentType, folder, ext }) {
  return putBytes({ buffer, contentType, folder, ext, isPrivate: true });
}

export async function getObject(key) {
  return client().fetch(objectUrl(key), { method: 'GET' });
}

export async function deleteObject(url) {
  let key;
  const storagePrefix = `${bucketUrl()}/`;
  if (url?.startsWith(storagePrefix)) {
    key = url.slice(storagePrefix.length);
  } else if (typeof url === 'string') {
    const publicPath = `/api/media/`;
    const path = new URL(url, process.env.NEXT_PUBLIC_SITE_URL || 'https://store.invalid').pathname;
    if (path.startsWith(publicPath)) key = path.slice(publicPath.length).split('/').map(decodeURIComponent).join('/');
  }
  if (!key) return { skipped: true };
  const res = await client().fetch(objectUrl(key), { method: 'DELETE' });
  if (!res.ok) await throwResponseError('Image delete', res);
  return { deleted: true };
}

export async function listObjects(prefix = '') {
  const res = await client().fetch(`${bucketUrl()}?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=100`);
  if (!res.ok) await throwResponseError('Storage list', res);
  return res.text();
}
