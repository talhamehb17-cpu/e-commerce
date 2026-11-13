import { sql, sha256 } from './db.js';
import crypto from 'node:crypto';

/** Create (or replace) a 6-digit one-time code and return the plain code for emailing. */
export async function issueOtp(email, purpose) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await sql`update otp_codes set consumed_at = now() where email = ${email} and purpose = ${purpose} and consumed_at is null`;
  await sql`
    insert into otp_codes (email, code_hash, purpose, expires_at)
    values (${email}, ${sha256(`${purpose}:${code}`)}, ${purpose}, ${expires})
  `;
  return code;
}

export async function verifyOtp(email, purpose, code) {
  const rows = await sql`
    select id, code_hash, expires_at, attempts from otp_codes
    where email = ${email} and purpose = ${purpose} and consumed_at is null
    order by created_at desc limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: 'Request a new code.' };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: 'That code has expired. Request a new one.' };
  if (row.attempts >= 6) return { ok: false, error: 'Too many attempts. Request a new code.' };
  if (row.code_hash !== sha256(`${purpose}:${code}`)) {
    await sql`update otp_codes set attempts = attempts + 1 where id = ${row.id}`;
    return { ok: false, error: 'That code is not correct.' };
  }
  await sql`update otp_codes set consumed_at = now() where id = ${row.id}`;
  return { ok: true };
}
