import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { captureCart } from '../apps/api/src/capture.ts';
import { RunService } from '../apps/api/src/runs.ts';
import { createApp } from '../apps/api/src/app.ts';
import type { Run } from '../packages/contracts/src/index.ts';

async function migrate(db: PGlite) {
  for (const name of ['001_demo.sql', '002_runs.sql']) await db.exec(await readFile(new URL(`../apps/api/migrations/${name}`, import.meta.url), 'utf8'));
}

test('real SDK capture records 2/21/2 queries, stable output, and connected parent IDs', async () => {
  const db = new PGlite();
  try {
    await migrate(db);
    const traces = [];
    for (const variant of ['baseline', 'regressed', 'fixed'] as const) traces.push(await captureCart(db, variant));
    assert.deepEqual(traces.map(t => t.queryCount), [2, 21, 2]);
    assert.equal(new Set(traces.map(t => t.outputDigest)).size, 1);
    assert.equal(new Set(traces.map(t => t.traceId)).size, 3);
    for (const t of traces) {
      assert.equal(t.complete, true); assert.equal(t.appOutcome, 'ok');
      assert.equal(t.spans.length, t.queryCount + 2);
      const root = t.spans.find(s => !s.parentSpanId)!;
      assert.equal(root.operation, 'cart.request');
      assert.ok(t.durationMs >= 0);
      for (const span of t.spans) {
        assert.match(span.spanId, /^[a-f0-9]{16}$/);
        assert.equal(span.traceId, t.traceId);
        if (span.parentSpanId) assert.ok(t.spans.some(s => s.spanId === span.parentSpanId));
        assert.ok(span.durationMs >= 0);
        assert.equal(span.status, 'ok');
      }
    }
    assert.equal(traces[1].spans.filter(s => s.operation === 'db.sellerOne').length, 20);
  } finally { await db.close(); }
});

test('SQL failures remain visible as application errors without exposing raw error details', async () => {
  const result = await captureCart({ query: async () => { throw new Error('password=secret user@example.com'); } }, 'baseline');
  assert.equal(result.appOutcome, 'error');
  assert.equal(result.complete, true); // Complete evidence of a failed application operation.
  assert.equal(result.outputDigest, null);
  assert.equal(result.queryCount, 1);
  assert.equal(result.spans.filter(s => s.status === 'error').length, 3);
  assert.doesNotMatch(JSON.stringify(result), /secret|example.com/);
});

test('span limit reports incomplete evidence rather than pretending the capture is complete', async () => {
  const result = await captureCart({ query: async sql => ({ rows: sql.includes('demo.products') ? Array.from({ length: 110 }, (_, i) => ({ id: i + 1, name: 'Synthetic', price_cents: 1, seller_id: 1 })) : [{ id: 1, name: 'Seller' }] }) }, 'regressed');
  assert.equal(result.complete, false);
  assert.equal(result.spans.length, 100);
});

test('HTTP sessions isolate runs; idempotent saves survive database reopen; restart marks unfinished runs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tracelens-test-'));
  let db = new PGlite(join(directory, 'data'));
  await migrate(db);
  let runs = new RunService(db, 'test-pglite');
  await runs.initialize();
  const server = createApp(db, runs).listen(0, '127.0.0.1');
  await once(server, 'listening');
  let saved: Run | undefined;
  let owner = '';
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const first = await fetch(base + '/api/session', { method: 'POST' });
    const cookie = first.headers.get('set-cookie')!.split(';')[0];
    assert.match(first.headers.get('set-cookie')!, /HttpOnly/);
    const other = await fetch(base + '/api/session', { method: 'POST' });
    const otherCookie = other.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await fetch(base + '/api/runs')).status, 401);
    const idempotencyKey = randomUUID();
    const post = (body: unknown, extra: Record<string, string> = {}) => fetch(base + '/api/runs', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) });
    assert.equal((await post({ variant: 'invalid', idempotencyKey })).status, 400);
    assert.equal((await post({ variant: 'baseline', idempotencyKey }, { origin: 'https://untrusted.example' })).status, 403);
    const created = await post({ variant: 'baseline', idempotencyKey });
    assert.equal(created.status, 202);
    const initial = await created.json() as Run;
    // Service stop drains the real background job, without a polling delay.
    await runs.stop();
    saved = await (await fetch(base + '/api/runs/' + initial.id, { headers: { cookie } })).json() as Run;
    assert.equal(saved.status, 'complete');
    assert.deepEqual(saved.traces.map(t => t.queryCount), [2, 2, 2]);
    const replay = await post({ variant: 'baseline', idempotencyKey });
    assert.equal(replay.status, 200); assert.equal((await replay.json() as Run).id, saved.id);
    assert.equal((await post({ variant: 'fixed', idempotencyKey })).status, 409);
    assert.equal((await fetch(base + '/api/runs/' + saved.id, { headers: { cookie: otherCookie } })).status, 404);
    assert.deepEqual(await (await fetch(base + '/api/runs', { headers: { cookie: otherCookie } })).json(), []);
    const evidence = await (await fetch(base + '/api/runs/' + saved.id + '/traces', { headers: { cookie } })).json();
    assert.deepEqual(evidence, saved.traces);
    owner = (await db.query<{ session_hash: string }>('SELECT session_hash FROM app.runs WHERE id = $1', [saved.id])).rows[0].session_hash;
    await db.query("INSERT INTO app.runs(id,session_hash,idempotency_key,variant,status,environment) VALUES($1,$2,$3,'fixed','running','test-pglite')", [randomUUID(), owner, randomUUID()]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    await runs.stop(); await db.close();
  }
  try {
    db = new PGlite(join(directory, 'data'));
    runs = new RunService(db, 'test-pglite'); await runs.initialize();
    assert.deepEqual(await runs.get(owner, saved!.id), saved);
    const recovered = await runs.list(owner);
    assert.equal(recovered.find(r => r.id !== saved!.id)?.status, 'interrupted');
  } finally { await runs.stop(); await db.close(); await rm(directory, { recursive: true, force: true }); }
});
