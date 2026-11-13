import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1|55432/.test(url);
const sql = postgres(url, {
  max: 1,
  ssl: isLocal ? false : 'require',
  onnotice: () => {},
});

const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
try {
  await sql.unsafe(schema);
  const t = await sql`select count(*)::int n from information_schema.tables where table_schema='public'`;
  console.log(`✔ schema applied — ${t[0].n} tables in public schema`);
} catch (e) {
  console.error('✖ migration failed:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
