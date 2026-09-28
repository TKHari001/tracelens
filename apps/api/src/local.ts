// Development only: genuine PostgreSQL SQL via WASM, not a network PostgreSQL server.
import { PGlite } from '@electric-sql/pglite';
import { readFile, mkdir } from 'node:fs/promises';
import { createApp } from './app.ts';
import { RunService } from './runs.ts';

await mkdir('.local', { recursive: true });
const db = new PGlite('.local/postgres');
await db.exec(await readFile(new URL('../migrations/001_demo.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../migrations/002_runs.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../migrations/003_journeys.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../migrations/004_issues.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../migrations/005_full_schema.sql', import.meta.url), 'utf8'));
const runs = new RunService(db, 'local-pglite');
await runs.initialize();
const port = Number(process.env.PORT || 3001);
const server = createApp(db, runs).listen(port, '127.0.0.1', () => console.log(`Local preview: http://127.0.0.1:${port} (embedded PostgreSQL / PGlite)`));
let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  server.close(async () => { await runs.stop(); await db.close(); process.exit(0); });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
