import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { captureCart } from '../apps/api/src/capture.ts';
import { executeJourney, parseTraceparent } from '../apps/api/src/journey.ts';
import { compareRuns, compareJourneys } from '../packages/engine/src/compare.ts';
import type { Run } from '../packages/contracts/src/index.ts';

test('real run comparison exposes +19 queries, 60 seller spans, unchanged output, and the fixed result',async()=>{
  const db=new PGlite();
  try{
    await db.exec(await readFile(new URL('../apps/api/migrations/001_demo.sql',import.meta.url),'utf8'));
    const runs:Run[]=[];
    for(const variant of ['baseline','regressed','fixed'] as const){
      const traces=[];for(let i=0;i<3;i++)traces.push(await captureCart(db,variant));
      runs.push({id:randomUUID(),variant,status:'complete',createdAt:new Date().toISOString(),dataset:'cart-v1',instrumentationVersion:'manual-v1',environment:'test',traces,error:null});
    }
    const report=compareRuns(runs[0],runs[1]);
    assert.equal(report.queryDelta,19);assert.equal(report.output,'same');
    const seller=report.groups.find(g=>g.operation==='db.sellerOne')!;
    assert.equal(seller.change,'added');assert.equal(seller.beforeCount,0);assert.equal(seller.afterCount,20);assert.equal(seller.after.length,60);
    assert.ok(seller.after.every(s=>s.queryTemplate?.includes('WHERE id = $1')));
    assert.equal(report.groups.find(g=>g.operation==='db.sellersBatch')?.change,'removed');
    const fixed=compareRuns(runs[0],runs[2]);assert.equal(fixed.queryDelta,0);assert.equal(fixed.output,'same');
    assert.ok(fixed.groups.every(g=>g.beforeCount===g.afterCount));
    // IDs and ordering do not determine alignment.
    const reordered=structuredClone(runs[2]);reordered.traces.forEach(t=>t.spans.reverse());
    assert.deepEqual(compareRuns(runs[0],reordered).groups.map(g=>g.key),fixed.groups.map(g=>g.key));
    for(const mutate of [
      (r:Run)=>{r.status='incomplete';},(r:Run)=>{r.environment='other';},
      (r:Run)=>{r.traces.pop();},(r:Run)=>{r.traces[0].complete=false;},
      (r:Run)=>{r.traces[0].spans[1].parentSpanId='missing';},
      (r:Run)=>{r.traces[0].spans[1].parentSpanId=r.traces[0].spans[1].spanId;},
      (r:Run)=>{r.traces[0].spans.push(r.traces[0].spans[0]);},
      (r:Run)=>{r.traces[0].queryCount=999;},
    ]){const invalid=structuredClone(runs[2]);mutate(invalid);assert.throws(()=>compareRuns(runs[0],invalid));}
    const changedOutput=structuredClone(runs[2]);changedOutput.traces[0].outputDigest='a'.repeat(64);
    assert.equal(compareRuns(runs[0],changedOutput).output,'different');
    const missingOutput=structuredClone(runs[2]);missingOutput.traces[0].outputDigest=null;
    assert.equal(compareRuns(runs[0],missingOutput).output,'unavailable');
    const slower=structuredClone(runs[2]);for(const t of slower.traces){const span=t.spans.find(s=>s.operation==='db.products')!;span.durationMs+=100;}
    assert.equal(compareRuns(runs[0],slower).groups.find(g=>g.operation==='db.products')?.timingIncreased,true);
  }finally{await db.close();}
});

test('connected comparisons distinguish hidden failures from honest reporting and reject legacy metadata',async()=>{
  const db=new PGlite();
  try{
    await db.exec(await readFile(new URL('../apps/api/migrations/001_demo.sql',import.meta.url),'utf8'));
    const parent=parseTraceparent('00-11111111111111111111111111111111-1111111111111111-01')!;
    const healthy=(await executeJourney(db,'healthy',parent,'test')).evidence;
    const hidden=(await executeJourney(db,'hidden-error',parent,'test')).evidence;
    const honest=(await executeJourney(db,'honest-error',parent,'test')).evidence;
    const diff=compareJourneys(healthy,hidden);
    assert.equal(diff.beforeHttp,200);assert.equal(diff.afterHttp,200);assert.equal(diff.beforeProducts,20);assert.equal(diff.afterProducts,0);
    assert.ok(diff.findings.some(f=>f.startsWith('Hidden failure:')));
    assert.equal(diff.groups.find(g=>g.operation==='db.controlledFailure')?.after[0].errorCode,'22012');
    assert.ok(diff.warnings.some(w=>w.includes('Browser observation is missing')));
    const corrected=compareJourneys(hidden,honest);assert.equal(corrected.afterHttp,503);
    assert.ok(corrected.findings.some(f=>f.includes('database operation still fails')));
    const legacy=structuredClone(healthy);delete legacy.environment;assert.throws(()=>compareJourneys(legacy,hidden),/older requests/);
    assert.throws(()=>compareJourneys(healthy,healthy),/different requests/);
  }finally{await db.close();}
});
