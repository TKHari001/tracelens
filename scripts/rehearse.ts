import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Journey } from '../packages/contracts/src/index.ts';

const base = process.env.DEMO_URL || 'http://127.0.0.1:3001';
const call = (path: string, init?: RequestInit) => fetch(new URL(path, base), { ...init, signal: AbortSignal.timeout(15000) });
assert.equal((await call('/api/health/ready')).status,200,'Readiness check failed');
const recorded: Journey[] = [];
const rounds = [];
for (let round=1;round<=3;round++) {
  const session=await call('/api/session',{method:'POST'});
  assert.ok(session.ok,'Session creation failed');
  const cookie=session.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  for (const mode of ['healthy','hidden-error','honest-error'] as const) {
    const traceId=randomBytes(16).toString('hex'),spanId=randomBytes(8).toString('hex');
    const response=await call('/api/demo/cart',{method:'POST',headers:{cookie,'Content-Type':'application/json',traceparent:`00-${traceId}-${spanId}-01`},body:JSON.stringify({mode})});
    assert.equal(response.status,mode==='honest-error'?503:200);
    assert.equal(response.headers.get('x-trace-id'),traceId);
    const body=await response.json();
    assert.equal(body.products?.length??null,mode==='healthy'?20:mode==='hidden-error'?0:null);
    const historyResponse=await call('/api/journeys',{headers:{cookie}}); assert.ok(historyResponse.ok);
    const history=await historyResponse.json() as Journey[];
    const entry=history.find(j=>j.id===response.headers.get('x-journey-id')); assert.ok(entry);
    assert.equal(entry.spans[0].parentSpanId,spanId);
    assert.ok(entry.spans.every(s=>s.traceId===traceId));
    assert.equal(entry.spans.filter(s=>s.kind==='database').length,mode==='healthy'?2:1);
    if(mode!=='healthy')assert.equal(entry.spans.find(s=>s.errorCode)?.errorCode,'22012');
    if(round===1)recorded.push(entry);
  }
  rounds.push({round,passed:true,scenarios:3});
  console.log(`Rehearsal ${round}: healthy, hidden failure, and honest error passed.`);
}
await mkdir('demo',{recursive:true});
const report={recordedAt:new Date().toISOString(),source:'Automated HTTP rehearsal against '+base,live:false,notes:'Recorded evidence, not a live execution. Requests originated from the rehearsal CLI; no browser timing is recorded.',rounds,journeys:recorded};
await writeFile('demo/recorded-evidence.json',JSON.stringify(report,null,2)+'\n');
const esc=(value:unknown)=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>X-Ray Vision · Recorded demo backup</title><style>body{font:16px system-ui;background:#f3f6ef;color:#233c2b;max-width:1000px;margin:40px auto;padding:20px}h1{font-size:36px}article{background:white;border:1px solid #cfdbc4;border-radius:12px;padding:24px;margin:22px 0}small,p{line-height:1.7}strong{color:#814b20}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eff4e9;padding:16px;font-size:12px}summary{cursor:pointer;padding:12px 0}.label{background:#ffe5ad;padding:14px;border-radius:8px}</style><h1>X-Ray Vision</h1><div class="label"><b>RECORDED BACKUP — NOT LIVE</b><br>${esc(report.notes)}</div><p>Captured ${esc(report.recordedAt)}. All three automated rehearsals passed.</p>${recorded.map(j=>`<article><h2>${esc(j.mode)}</h2><strong>${esc(j.finding)}</strong><p>HTTP ${j.httpStatus} · ${j.productCount??'No'} products · ${j.spans.filter(s=>s.kind==='database').length} database operations</p><p>Request client → API → backend → database</p><small>Trace ${esc(j.traceId)}<br>Browser timing: unavailable (CLI capture)</small><details><summary>Inspect recorded SQL and span evidence</summary>${j.spans.map(s=>`<pre>${esc(s.operation)} · ${s.status} · ${s.durationMs.toFixed(2)} ms\nSpan: ${esc(s.spanId)}\nParent: ${esc(s.parentSpanId)}${s.queryTemplate?'\nSQL: '+esc(s.queryTemplate):''}${s.errorCode?'\nSQLSTATE: '+esc(s.errorCode):''}</pre>`).join('')}</details></article>`).join('')}<p>This file works without a server or network connection. These are real saved measurements from the local synthetic demo, not new execution results.</p></html>`;
await writeFile('demo/recorded-demo.html',html);
console.log('Saved demo/recorded-evidence.json and standalone demo/recorded-demo.html.');
