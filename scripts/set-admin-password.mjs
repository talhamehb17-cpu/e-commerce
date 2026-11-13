/**
 * Owner-only, out-of-band admin bootstrap/reset. Requires private DATABASE_URL,
 * ADMIN_EMAIL and ADMIN_PASSWORD in the process environment. Never logs secrets.
 */
import { sql, hashPassword } from '../src/lib/db.js';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('A valid ADMIN_EMAIL is required.');
  if (!password || password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');

  const result = await sql.begin(async (tx) => {
    const matches = await tx`select id, role, is_active from admins where lower(email) = ${email} for update`;
    if (matches[0]) {
      if (matches[0].role !== 'owner' || !matches[0].is_active) {
        throw new Error('Refusing to reset a non-owner or inactive account.');
      }
      await tx`update admins set password_hash = ${hashPassword(password)}, updated_at = now() where id = ${matches[0].id}`;
      await tx`update sessions set revoked_at = now() where subject_type = 'admin' and subject_id = ${matches[0].id} and revoked_at is null`;
      await tx`insert into audit_logs (actor_type, actor_id, actor_email, action, entity, entity_id, meta) values ('system', ${matches[0].id}, ${email}, 'owner_password_reset', 'admin', ${matches[0].id}, '{}'::jsonb)`;
      return 'reset';
    }

    const existing = await tx`select count(*)::int as count from admins`;
    if (existing[0].count !== 0) {
      throw new Error('An admin already exists. Use its exact owner email; refusing to add an unexpected owner.');
    }
    const created = await tx`insert into admins (name, email, password_hash, role, permissions) values ('Store Owner', ${email}, ${hashPassword(password)}, 'owner', '["*"]'::jsonb) returning id`;
    await tx`insert into audit_logs (actor_type, actor_id, actor_email, action, entity, entity_id, meta) values ('system', ${created[0].id}, ${email}, 'owner_account_created', 'admin', ${created[0].id}, '{}'::jsonb)`;
    return 'created';
  });

  console.log(`Owner account ${result} for ${email}. All prior admin sessions have been revoked.`);
}

main().catch((error) => {
  console.error(`Admin setup failed: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await sql.end();
});
