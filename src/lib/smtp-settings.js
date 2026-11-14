import crypto from 'node:crypto';
import { sql } from '@/lib/db';
const KEY_NAME = 'smtp_config';
let configCache = null;
let configCacheUntil = 0;
function keyBytes() {
  const raw = process.env.SMTP_CREDENTIALS_KEY || '';
  let key;
  if (/^[a-f\d]{64}$/i.test(raw)) key = Buffer.from(raw, 'hex');
  else { try { key = Buffer.from(raw, 'base64'); } catch { key = null; } }
  if (!key || key.length !== 32) throw new Error('SMTP_CREDENTIALS_KEY must be a dedicated 32-byte base64 or 64-character hex key.');
  return key;
}
function encrypt(value) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: ciphertext.toString('base64') };
}
function decrypt(value) {
  if (!value || value.v !== 1) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(), Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'));
}
export async function readSmtpConfig() {
  if (configCacheUntil > Date.now()) return configCache;
  const rows = await sql`select value from settings where key = ${KEY_NAME} limit 1`;
  if (!rows[0]) { configCache = null; configCacheUntil = Date.now() + 3000; return null; }
  try { configCache = decrypt(rows[0].value); configCacheUntil = Date.now() + 3000; return configCache; }
  catch { console.error('SMTP settings unavailable: decryption failed'); configCache = null; configCacheUntil = Date.now() + 1000; return null; }
}
export async function saveSmtpConfig(value) {
  const encrypted = encrypt(value);
  await sql`insert into settings(key,value,updated_at) values(${KEY_NAME},${sql.json(encrypted)},now()) on conflict(key) do update set value=excluded.value,updated_at=now()`;
  configCache = value; configCacheUntil = Date.now() + 3000;
}
export async function smtpStatus() {
  const value = await readSmtpConfig().catch(() => null);
  return { configured: !!(value?.host && value?.username && value?.password), host: value?.host || '', port: value?.port || 587, username: value?.username || '', sender: value?.sender || '', recipient: value?.recipient || '', orderNotifications: value?.orderNotifications ?? true, hasStoredPassword: !!value?.password };
}
