/**
 * Local Postgres for development: PGlite exposed over the wire protocol on :55432.
 * Data is persisted in ./.localdb (git-ignored). No Docker required.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '..', '.localdb');
const port = Number(process.env.PGLITE_PORT || 55432);
const db = await PGlite.create({ dataDir });
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
await server.start();
console.log(`→ local Postgres (PGlite) ready on 127.0.0.1:${port}`);
console.log(`  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);
