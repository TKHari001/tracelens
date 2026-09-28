import { pool } from './db.ts';
import { createApp } from './app.ts';
import { RunService } from './runs.ts';

const port = Number(process.env.PORT || 3001);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (process.env.NODE_ENV === 'production' && (!process.env.APP_ORIGIN || !/^https:\/\/[^/]+$/.test(process.env.APP_ORIGIN))) throw new Error('APP_ORIGIN must be the public HTTPS origin, without a trailing slash.');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
const runs = new RunService(pool, 'postgres-server');
await runs.initialize();
const server = createApp(pool, runs).listen(port, process.env.HOST || '127.0.0.1', () => console.log(`TraceLens listening on http://localhost:${port}`));
server.requestTimeout = 20000;
server.headersTimeout = 15000;
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 20000).unref();
  server.close(async () => { await runs.stop(); await pool.end(); clearTimeout(deadline); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
