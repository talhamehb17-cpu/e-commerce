import crypto from 'node:crypto';
import { sql } from '@/lib/db';

const KEY_NAME = 'smtp_config';
let configCache = null;
let configCacheUntil = 0;

/** Report key metadata only; the value is never included in a response or log. */
export function smtpKeyStatus() {
  const raw = process.env.SMTP_CREDENTIALS_KEY || '';
  if (!raw) return { present: false, valid: false, format: 'missing' };
  if (/^[a-f\d]{64}$/i.test(raw)) return { present: true, valid: true, format: 'hex' };
  if (/^[A-Za-z0-9+/]{43}=$/.test(raw)) {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32 && decoded.toString('base64') === raw) {
      return { present: true, valid: true, format: 'base64' };
    }
  }
  return { present: true, valid: false, format: 'invalid' };
}

function keyBytes() {
  const status = smtpKeyStatus();
  if (!status.present) throw new Error('SMTP_CREDENTIALS_KEY is not available to this server runtime.');
  if (!status.valid) throw new Error('SMTP_CREDENTIALS_KEY must be 32-byte Base64 or 64-character hexadecimal.');
  const raw = process.env.SMTP_CREDENTIALS_KEY;
  return status.format === 'hex' ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: ciphertext.toString('base64') };
}

function decrypt(value) {
  if (!value || value.v !== 1) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(), Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'));
}

/** A status-rich read lets the owner avoid overwriting ciphertext they cannot decrypt. */
export async function readSmtpConfigState() {
  const rows = await sql`select value from settings where key = ${KEY_NAME} limit 1`;
  if (!rows[0]) return { state: 'missing', config: null };
  try {
    const config = decrypt(rows[0].value);
    if (!config) return { state: 'unreadable', config: null };
    return { state: 'readable', config };
  } catch {
    // Do not log the encrypted record, key, password, or crypto exception details.
    console.error('SMTP settings could not be decrypted with the current server key.');
    return { state: 'unreadable', config: null };
  }
}

export async function readSmtpConfig() {
  if (configCacheUntil > Date.now()) return configCache;
  const stored = await readSmtpConfigState();
  configCache = stored.config;
  configCacheUntil = Date.now() + (stored.state === 'unreadable' ? 1000 : 3000);
  return configCache;
}

export async function saveSmtpConfig(value) {
  const encrypted = encrypt(value);
  // Verify that encryption is reversible before writing, without returning any credential.
  const roundTrip = decrypt(encrypted);
  if (roundTrip?.password !== value?.password) throw new Error('SMTP credential encryption verification failed.');

  await sql.begin(async (tx) => {
    await tx`insert into settings(key,value,updated_at) values(${KEY_NAME},${tx.json(encrypted)},now()) on conflict(key) do update set value=excluded.value,updated_at=now()`;
    const rows = await tx`select value from settings where key = ${KEY_NAME} limit 1`;
    const persisted = rows[0] ? decrypt(rows[0].value) : null;
    if (persisted?.password !== value?.password) throw new Error('SMTP credential read-back verification failed.');
  });

  configCache = value;
  configCacheUntil = Date.now() + 3000;
}

export async function smtpStatus() {
  const value = await readSmtpConfig();
  return {
    configured: !!(value?.host && value?.username && value?.password),
    host: value?.host || '',
    port: value?.port || 587,
    username: value?.username || '',
    sender: value?.sender || '',
    senderName: value?.senderName || 'NOVA',
    replyTo: value?.replyTo || '',
    recipient: value?.recipient || '',
    orderNotifications: value?.orderNotifications ?? true,
    notifications: value?.notifications || {},
    hasStoredPassword: !!value?.password,
  };
}
