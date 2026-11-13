import postgres from 'postgres';
import crypto from 'node:crypto';

export const isLocalDb = (u = process.env.DATABASE_URL) => !!u && /localhost|127\.0\.0\.1|55432/.test(u);

/** Shared postgres client (connection pool friendly for serverless). */
export function createClient(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not configured');
  return postgres(url, {
    max: isLocalDb(url) ? 4 : 5,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: isLocalDb(url) ? false : 'require',
    prepare: false,
    onnotice: () => {},
  });
}

const globalForDb = globalThis;
export const sql = globalForDb.__aurelleSql ?? (globalForDb.__aurelleSql = createClient());

/** Simple deterministic cache for hot reads (per server instance). */
const cache = (globalForDb.__aurelleCache ??= new Map());
export async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.exp > now) return hit.value;
  const value = await fn();
  cache.set(key, { value, exp: now + ttlMs });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return value;
}
export function invalidate(prefix = '') {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

export const nowIso = () => new Date().toISOString();

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}
export function sha256(v) {
  return crypto.createHash('sha256').update(String(v)).digest('hex');
}

/* ---------- password hashing (scrypt, no native deps) ---------- */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export function verifyPassword(password, stored) {
  try {
    const [algo, N, r, p, saltB64, hashB64] = String(stored).split('$');
    if (algo !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(password.normalize('NFKC'), salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function rateLimit(key, limit, windowMs) {
  const store = (globalForDb.__aurelleRl ??= new Map());
  const now = Date.now();
  const rec = store.get(key);
  if (!rec || rec.reset < now) {
    store.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  rec.count += 1;
  if (store.size > 5000) store.clear();
  return { ok: rec.count <= limit, remaining: Math.max(0, limit - rec.count) };
}
