import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { RunService } from '../apps/api/src/runs.ts';
import { createApp } from '../apps/api/src/app.ts';
import { parseTraceparent } from '../apps/api/src/journey.ts';
import type { Journey } from '../packages/contracts/src/index.ts';

test('real HTTP journey links browser context, SQL failure, HTTP outcome, and owned saved evidence', async () => {
  const db = new PGlite();
  for (const name of ['001_demo.sql','002_runs.sql','003_journeys.sql']) await db.exec(await readFile(new URL(`../apps/api/migrations/${name}`, import.meta.url), 'utf8'));
  const runs = new RunService(db, 'test');
  const server = createApp(db, runs).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const session = await fetch(base + '/api/session', { method: 'POST' });
    const cookie = session.headers.get('set-cookie')!.split(';')[0];
    const second = await fetch(base + '/api/session', { method: 'POST' });
    const other = second.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await fetch(base + '/api/journeys')).status, 401);
    for (const mode of ['healthy','hidden-error','honest-error'] as const) {
      const traceId = randomBytes(16).toString('hex'), spanId = randomBytes(8).toString('hex');
      const response = await fetch(base + '/api/demo/cart', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json', traceparent: `00-${traceId}-${spanId}-01` }, body: JSON.stringify({ mode }) });
      assert.equal(response.status, mode === 'honest-error' ? 503 : 200);
      assert.equal(response.headers.get('X-Trace-Id'), traceId);
      const body = await response.json();
      if (mode === 'healthy') assert.equal(body.products.length, 20);
      if (mode === 'hidden-error') assert.deepEqual(body.products, []);
      if (mode === 'honest-error') assert.match(body.error, /database operation failed/);
      const id = response.headers.get('X-Journey-Id')!;
      const history = await (await fetch(base + '/api/journeys', { headers: { cookie } })).json() as Journey[];
      const evidence = history.find(j => j.id === id)!;
      assert.equal(evidence.traceId, traceId);
      assert.equal(evidence.browser, null);
      assert.equal(evidence.spans[0].parentSpanId, spanId);
      assert.ok(evidence.spans.every(s => s.traceId === traceId));
      assert.equal(evidence.spans[1].parentSpanId, evidence.spans[0].spanId);
      assert.ok(evidence.spans.filter(s => s.kind === 'database').every(s => s.parentSpanId === evidence.spans[1].spanId));
      if (mode !== 'healthy') {
        assert.equal(evidence.spans.find(s => s.kind === 'database')?.errorCode, '22012');
        assert.equal(evidence.spans[1].status, 'error');
        assert.equal(evidence.spans[0].status, mode === 'hidden-error' ? 'ok' : 'error');
      }
      const observation = { durationMs: 12.5, status: response.status, productCount: body.products?.length ?? null };
      const attach = (token: string) => fetch(base + `/api/journeys/${id}/browser`, { method: 'POST', headers: { cookie: token, 'Content-Type': 'application/json' }, body: JSON.stringify(observation) });
      assert.equal((await attach(other)).status, 404);
      const attached = await attach(cookie); assert.equal(attached.status, 200);
      assert.deepEqual((await attached.json()).browser, observation);
      assert.equal((await attach(cookie)).status, 404);
    }
    const saved = await (await fetch(base + '/api/journeys', { headers: { cookie } })).json() as Journey[];
    assert.equal(saved.length, 3); assert.ok(saved.every(j => j.browser));
    const healthy=saved.find(j=>j.mode==='healthy')!, hidden=saved.find(j=>j.mode==='hidden-error')!;
    const compare=(token:string,body:unknown)=>fetch(base+'/api/comparisons',{method:'POST',headers:{cookie:token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const comparisonInput={kind:'journeys',beforeId:healthy.id,afterId:hidden.id};
    const compared=await compare(cookie,comparisonInput);assert.equal(compared.status,200);
    assert.equal((await compared.json()).afterProducts,0);
    assert.equal((await compare(other,comparisonInput)).status,404);
    assert.equal((await compare(cookie,{...comparisonInput,afterId:healthy.id})).status,422);
    assert.equal((await compare(cookie,{...comparisonInput,beforeId:'invalid'})).status,400);
    assert.deepEqual(await (await fetch(base + '/api/journeys', { headers: { cookie: other } })).json(), []);
    const invalid = await fetch(base + '/api/demo/cart', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json', traceparent: 'invalid' }, body: JSON.stringify({ mode: 'hidden-error' }) });
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await runs.stop(); await db.close();
  }
});

test('traceparent validation rejects missing or zero identities', () => {
  assert.equal(parseTraceparent(undefined), null);
  assert.equal(parseTraceparent('00-' + '0'.repeat(32) + '-' + '1'.repeat(16) + '-01'), null);
  assert.equal(parseTraceparent('00-' + '1'.repeat(32) + '-' + '0'.repeat(16) + '-01'), null);
});
