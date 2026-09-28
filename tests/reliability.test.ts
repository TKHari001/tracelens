import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { ReliabilityEngine, classifySeverity, policyDecision, riskWindow, reliabilityRoutes } from '../apps/api/src/reliability.ts';
import type { Sample } from '../packages/contracts/src/reliability.ts';

function fixture() {
  let now = 100000;
  const engine = new ReliabilityEngine({ query: async () => ({ rows: [{ healthy: 1 }] }) }, () => now);
  return { engine, step: async () => { now += 2100; await engine.tick(); } };
}
test('severity boundaries and core/security overrides', () => {
  for (const [value, severity] of [[0,'SEV-4'],[30,'SEV-3'],[55,'SEV-2'],[75,'SEV-1'],[90,'SEV-0']] as const) assert.equal(classifySeverity(Array(7).fill(value)).severity,severity);
  assert.equal(classifySeverity(Array(7).fill(0),true).severity,'SEV-1');
  assert.equal(classifySeverity(Array(7).fill(0),false,true).severity,'SEV-0');
  assert.equal(classifySeverity(Array(7).fill(0),false,false,95).severity,'SEV-1');
  assert.throws(() => classifySeverity([NaN]));
});
test('worker recovers automatically only after five clean verification windows', async () => {
  const {engine,step}=fixture();
  await engine.inject('worker');
  assert.equal(engine.incident!.severity,'SEV-3');
  assert.equal(engine.incident!.status,'REMEDIATION_PROPOSED');
  await step(); assert.equal(engine.incident!.status,'VERIFYING');
  for(let i=0;i<4;i++) await step();
  assert.equal(engine.incident!.status,'VERIFYING');
  await step(); assert.equal(engine.incident!.status,'RESOLVED');
  assert.equal(engine.incident!.attempts,1);
  assert.equal(engine.incident!.after.every(s=>s.errorRate===0),true);
});
test('critical incident rejects stale/repeated approvals and waits for approval', async () => {
  const {engine,step}=fixture(); await engine.inject('payment');
  await step(); assert.equal(engine.incident!.status,'AWAITING_APPROVAL');
  assert.throws(()=>engine.approve('wrong'));
  engine.approve(engine.incident!.id);
  assert.throws(()=>engine.approve(engine.incident!.id));
  for(let i=0;i<5;i++) await step();
  assert.equal(engine.incident!.status,'RESOLVED');
});
test('cascade correlates database origin; kill switch blocks even human-approved execution',async()=>{
  const {engine,step}=fixture(); await engine.inject('database');
  assert.equal(engine.incident!.root,'database');
  assert.deepEqual(engine.incident!.affected,['gateway','orders','payment','database']);
  engine.setAutomation(false); await step();
  assert.equal(engine.incident!.attempts,0);
  assert.throws(()=>engine.approve(engine.incident!.id));
  engine.setAutomation(true); engine.approve(engine.incident!.id);
  for(let i=0;i<5;i++) await step();
  assert.equal(engine.incident!.status,'RESOLVED');
});
test('failed recovery rolls back and escalates without retrying or claiming resolution',async()=>{
  const {engine,step}=fixture(); await engine.inject('worker',true);
  await step(); await step();
  assert.equal(engine.incident!.status,'ESCALATED');
  await step(); assert.equal(engine.incident!.attempts,1);
  assert.equal(engine.incident!.verificationPasses,0);
  assert.match(engine.incident!.timeline.at(-1)!.message,/rollback/);
  engine.reset(); await step(); assert.equal(engine.samples.every(s=>s.errorRate===0),true);
  assert.equal(engine.history[0].status,'ESCALATED');
});
test('policy rejects unknown runbooks; forecasts require a rising measured trend',()=>{
  assert.equal(policyDecision({scenario:'worker',runbook:'SHELL',attempts:0,severity:'SEV-3',affected:['worker']},true),'BLOCK');
  const sample:Sample={service:'payment',at:60000,errorRate:40,latencyMs:1,error:null};
  assert.equal(riskWindow(undefined,sample),null);
  assert.equal(riskWindow({...sample,at:0,errorRate:20},sample),2);
  assert.equal(riskWindow({...sample,at:0,errorRate:60},sample),null);
});
test('reliability HTTP boundary validates actions and isolates sessions',async()=>{
  const app=express();app.use(express.json());app.use((req,res,next)=>{res.locals.owner=req.get('test-owner');next();});
  app.use('/reliability',reliabilityRoutes({query:async()=>({rows:[{healthy:1}]})}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const addr=server.address();assert.ok(addr&&typeof addr!=='string'); const base=`http://127.0.0.1:${addr.port}/reliability`;
    assert.equal((await fetch(base)).status,401);
    const headers={'Content-Type':'application/json','test-owner':'one'};
    assert.equal((await fetch(base+'/inject',{method:'POST',headers,body:JSON.stringify({scenario:'shell'})})).status,400);
    assert.equal((await fetch(base+'/inject',{method:'POST',headers,body:JSON.stringify({scenario:'payment'})})).status,200);
    const other=await (await fetch(base,{headers:{'test-owner':'two'}})).json();assert.equal(other.incident,null);
    assert.equal((await fetch(base+'/approve',{method:'POST',headers:{...headers,'test-owner':'two'},body:JSON.stringify({id:'11111111-1111-4111-8111-111111111111'})})).status,409);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
