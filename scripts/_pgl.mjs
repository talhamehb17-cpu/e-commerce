import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
const db = await PGlite.create({ dataDir: '/home/user/e-commerce/.localdb' });
const server = new PGLiteSocketServer({ db, port: 55432, host: '127.0.0.1' });
await server.start();
console.log('READY 55432');
