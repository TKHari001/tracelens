import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { requestLimit } from '../apps/api/src/limits.ts';
import { createApp } from '../apps/api/src/app.ts';
import { RunService } from '../apps/api/src/runs.ts';

test('request limiter blocks a noisy client, preserves others, and resets after the window', async () => {
  let now = 0;
  const app = express();
  app.use(requestLimit(2, 1000, req => req.get('test-client') || 'one', () => now));
  app.get('/', (_req,res) => res.json({ok:true}));
  const server = app.listen(0,'127.0.0.1'); await once(server,'listening');
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(url)).status,200);
    assert.equal((await fetch(url)).status,200);
    const limited = await fetch(url); assert.equal(limited.status,429); assert.equal(limited.headers.get('retry-after'),'1');
    assert.equal((await fetch(url,{headers:{'test-client':'two'}})).status,200);
    now = 1001; assert.equal((await fetch(url)).status,200);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('expired session cleanup cascades evidence while valid and active sessions survive', async () => {
  const db = new PGlite();
  const runs = new RunService(db,'test');
  try {
    for (const name of ['001_demo.sql','002_runs.sql','003_journeys.sql']) await db.exec(await readFile(new URL(`../apps/api/migrations/${name}`,import.meta.url),'utf8'));
    await db.exec("INSERT INTO app.sessions VALUES ('expired', now() - interval '2 hours'), ('valid', now() + interval '1 hour'), ('active', now() - interval '2 hours'); INSERT INTO app.journeys(id,session_hash,evidence) VALUES ('11111111-1111-4111-8111-111111111111','expired','{}'); INSERT INTO app.runs(id,session_hash,idempotency_key,variant,status,environment) VALUES ('22222222-2222-4222-8222-222222222222','active','33333333-3333-4333-8333-333333333333','baseline','running','test')");
    await runs.cleanup();
    assert.deepEqual((await db.query('SELECT token_hash FROM app.sessions ORDER BY token_hash')).rows,[{token_hash:'active'},{token_hash:'valid'}]);
    assert.equal((await db.query('SELECT * FROM app.journeys')).rows.length,0);
  } finally { await runs.stop(); await db.close(); }
});

test('HTTP guards return JSON for malformed/oversized payloads and set security headers',async () => {
  const server = createApp({query:async()=>({rows:[]})}).listen(0,'127.0.0.1'); await once(server,'listening');
  try {
    const address=server.address();assert.ok(address&&typeof address!=='string');
    const base=`http://127.0.0.1:${address.port}`;
    const health=await fetch(base+'/api/health/live');
    assert.match(health.headers.get('content-security-policy')!,/frame-ancestors 'none'/);
    assert.equal(health.headers.get('cache-control'),'no-store');
    assert.equal(health.headers.get('x-frame-options'),'DENY');
    for(const [body,status] of [['{',400],[JSON.stringify({value:'x'.repeat(5000)}),413]] as const){
      const response=await fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body});
      assert.equal(response.status,status);assert.ok((await response.json()).error);
    }
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
