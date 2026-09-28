import { useEffect, useState } from 'react';
import type { Comparison, Journey, Run } from '../../../packages/contracts/src/index.ts';
import { startSession } from './RunPanel.tsx';
import './comparison.css';

type Choice={id:string;label:string;preferredBefore:boolean;preferredAfter:boolean};
export function ComparisonPanel(){
  const [kind,setKind]=useState<'runs'|'journeys'>('journeys');
  const [choices,setChoices]=useState<Choice[]>([]);
  const [before,setBefore]=useState(''),[after,setAfter]=useState('');
  const [report,setReport]=useState<Comparison|null>(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [refresh,setRefresh]=useState(0),[showAll,setShowAll]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    setLoading(true);setError('');setReport(null);
    void(async()=>{
      try{
        await startSession();const response=await fetch(`/api/${kind}`);
        const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load evidence.');
        const items:Choice[]=kind==='runs'?(data as Run[]).map(r=>({id:r.id,label:`${r.variant} · ${r.status} · ${new Date(r.createdAt).toLocaleTimeString()} · ${r.id.slice(0,8)}`,preferredBefore:r.variant==='baseline',preferredAfter:r.variant==='regressed'})):(data as Journey[]).map(j=>({id:j.id,label:`${j.mode} · HTTP ${j.httpStatus} · ${new Date(j.createdAt).toLocaleTimeString()} · ${j.id.slice(0,8)}`,preferredBefore:j.mode==='healthy',preferredAfter:j.mode==='hidden-error'}));
        if(cancelled)return;
        setChoices(items);const first=items.find(c=>c.preferredBefore)?.id??items[1]?.id??items[0]?.id??'';
        setBefore(first);setAfter(items.find(c=>c.preferredAfter&&c.id!==first)?.id??items.find(c=>c.id!==first)?.id??'');
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Could not load evidence.');}
      finally{if(!cancelled)setLoading(false);}
    })();return()=>{cancelled=true;};
  },[kind,refresh]);
  async function compare(){
    setBusy(true);setError('');setReport(null);
    try{const response=await fetch('/api/comparisons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,beforeId:before,afterId:after})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Comparison failed.');setReport(data);}
    catch(e){setError(e instanceof Error?e.message:'Comparison failed.');}finally{setBusy(false);}
  }
  return <section className="panel comparison-panel" id="compare">
    <div className="panel-title"><div><h2>What changed?</h2><p>Compare two saved captures and inspect the evidence behind each difference.</p></div><span className="tag">TRACEDIFF + QUERYLENS</span></div>
    <div className="comparison-controls"><label>Compare type<select value={kind} disabled={busy} onChange={e=>setKind(e.target.value as typeof kind)}><option value="journeys">Connected requests</option><option value="runs">Three-sample query runs</option></select></label><button disabled={busy||loading} onClick={()=>setRefresh(n=>n+1)}>Refresh comparison choices</button></div>
    <div className="comparison-controls">{(['Before','After'] as const).map(label=><label key={label}>{label}<select value={label==='Before'?before:after} disabled={busy||loading} onChange={e=>{(label==='Before'?setBefore:setAfter)(e.target.value);setReport(null);setError('');}}><option value="">Select saved capture</option>{choices.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>)}<button disabled={busy||loading||!before||!after||before===after} onClick={()=>void compare()}>{busy?'Comparing…':'Compare evidence'}</button></div>
    {loading&&<p className="run-note" role="status">Loading saved captures…</p>}{!loading&&choices.length<2&&<p className="run-note">Capture two requests above, or two query runs below, then refresh comparison choices.</p>}
    {error&&<div className="error" role="alert">{error}</div>}
    {report&&<div className="comparison-result">
      <div className="comparison-metrics"><article><span>Queries / execution</span><strong>{report.beforeQueries} → {report.afterQueries}</strong><small>{report.queryDelta>0?'+':''}{report.queryDelta} queries</small></article><article><span>{kind==='journeys'?'HTTP response':'Cart output'}</span><strong>{kind==='journeys'?`${report.beforeHttp} → ${report.afterHttp}`:report.output==='same'?'Identical':report.output==='different'?'Changed':'Unavailable'}</strong><small>{kind==='journeys'?`Products: ${report.beforeProducts??'unavailable'} → ${report.afterProducts??'unavailable'}`:'Checked against all captured output digests'}</small></article><article><span>Samples on each side</span><strong>{report.samples}</strong><small>Observed evidence; no automatic root-cause claim</small></article></div>
      <ul className="comparison-findings">{report.findings.map(f=><li key={f}>{f}</li>)}</ul>
      <label className="comparison-toggle"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> Show unchanged operations</label>
      {report.groups.filter(g=>showAll||g.change!=='unchanged').map(g=><details className="comparison-group" key={g.key}><summary><span className={`change-${g.change}`}>{g.change}</span> {g.operation} · calls {g.beforeCount} → {g.afterCount} · errors {g.beforeErrors} → {g.afterErrors}{g.timingIncreased?' · measured time increased':''}</summary>
        <p>Group time per execution: {g.beforeTotalMs.toFixed(2)} → {g.afterTotalMs.toFixed(2)} ms. {g.timingIncreased?'Increase exceeds both 20% and 20 ms.':''}</p>
        <div className="evidence-pair">{(['before','after'] as const).map(side=><section key={side}><h3>{side} · {g[side].length} saved spans across {report.samples} {report.samples===1?'execution':'executions'}</h3>{!g[side].length&&<p>This operation is absent from this capture.</p>}{g[side].map(s=><details key={s.traceId+s.spanId}><summary>{s.status} · {s.durationMs.toFixed(2)} ms · span {s.spanId}</summary><p className="digest">Trace: {s.traceId}<br/>Parent: {s.parentSpanId??'root'}</p>{s.queryTemplate&&<pre>{s.queryTemplate}</pre>}{s.errorCode&&<p>SQLSTATE: {s.errorCode}</p>}</details>)}</section>)}</div>
      </details>)}
      {!report.groups.some(g=>g.change!=='unchanged')&&<p>No structural, count, error, or significant timing changes detected. Enable unchanged operations to inspect the matching evidence.</p>}
      <div className="comparison-warnings">{report.warnings.map(w=><p key={w}>{w}</p>)}</div>
      <p className="digest">Before: {report.beforeId}<br/>After: {report.afterId}</p>
    </div>}
  </section>;
}
