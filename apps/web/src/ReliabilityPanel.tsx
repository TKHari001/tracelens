import { useEffect, useRef, useState } from 'react';
import { startSession } from './RunPanel.tsx';
import type { ReliabilitySnapshot, Scenario } from '../../../packages/contracts/src/reliability.ts';
import './reliability.css';

export function ReliabilityPanel() {
  const [data, setData] = useState<ReliabilitySnapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [failedDrill, setFailedDrill] = useState(false);
  const actionBusy = useRef(false);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        if (!actionBusy.current) {
          await startSession();
          const response = await fetch('/api/reliability');
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || 'Monitoring unavailable.');
          if (!cancelled && !actionBusy.current) setData(body);
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Monitoring unavailable.'); }
      finally { if (!cancelled) timer = setTimeout(() => void refresh(), 2500); }
    }
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  async function action(name: string, body = {}) {
    if (actionBusy.current) return;
    actionBusy.current = true; setBusy(true); setError('');
    try {
      await startSession();
      const response = await fetch(`/api/reliability/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Action failed.');
      setData(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); }
    finally { actionBusy.current = false; setBusy(false); }
  }
  const incident = data?.incident;
  const active = incident && !['RESOLVED', 'ESCALATED'].includes(incident.status);
  return <section id="reliability" className="panel reliability-panel">
    <div className="panel-title"><div><div className="eyebrow">OBSERVE → UNDERSTAND → REPAIR → VERIFY</div><h2>Reliability Lab</h2><p>See a failure, control the response, and prove recovery.</p></div><span className="tag">CONTROLLED SANDBOX</span></div>
    <div className="reliability-body">
      <p className="run-note">{data?.mode || 'Connecting to the reliability engine…'} Monitoring runs every two seconds while this dashboard is connected. History is kept for this server session.</p>
      <div className="lab-controls">{(['worker', 'payment', 'database'] as Scenario[]).map((s, i) => <button key={s} disabled={busy || Boolean(active) || !data} onClick={() => void action('inject', { scenario: s, failRecovery: failedDrill })}>{['1 · Worker failure', '2 · Payment failure', '3 · Database cascade'][i]}</button>)}<button disabled={busy || !data} onClick={() => void action('reset')}>Reset demo</button></div>
      <div className="lab-controls"><label><input type="checkbox" checked={data?.autonomous ?? true} disabled={busy || !data} onChange={e => void action('automation', { enabled: e.target.checked })}/> Allow demo runbooks (turn off to block new repairs)</label><label><input type="checkbox" checked={failedDrill} disabled={busy || Boolean(active)} onChange={e => setFailedDrill(e.target.checked)}/> Make next recovery fail</label></div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="lab-graph" aria-label="Dependencies: gateway calls orders, orders calls payment, payment calls database; worker is independent">
        {(['gateway', 'orders', 'payment', 'database', 'worker'] as const).map((name, index) => {
          const sample = data?.samples.find(s => s.service === name);
          return <article key={name} className={sample?.errorRate ? 'lab-failed' : sample ? 'lab-healthy' : ''}><span>{name}{index < 3 ? ' →' : name === 'worker' ? ' · independent' : ''}</span><strong>{sample ? sample.errorRate ? 'Failing' : 'Healthy' : 'Waiting'}</strong><small>{sample ? `${sample.errorRate}% errors · ${sample.latencyMs.toFixed(2)} ms / probe` : 'No probes yet'}</small>{incident?.root === name && active && <b>ROOT CANDIDATE</b>}</article>;
        })}
      </div>
      {!incident && <p className="empty">Choose a failure above. Watch the isolated worker recover automatically, or approve recovery for a critical dependency.</p>}
      {incident && <div className={`incident-card incident-${incident.severity.toLowerCase()} ${incident.status === 'RESOLVED' ? 'lab-resolved' : ''}`}>
        <div className="incident-head"><div><span>{incident.id.slice(0, 8)} · {incident.rca.source === 'ollama' ? 'LOCAL AI HYPOTHESIS' : 'RULE-BASED ANALYSIS'}</span><h3>{incident.status === 'RESOLVED' ? 'Recovery verified' : incident.status === 'ESCALATED' ? 'Recovery failed — human investigation required' : `${incident.root} failure`}</h3><p role="status">{incident.status.replaceAll('_', ' ')}</p></div><strong>{incident.severity}</strong></div>
        <div className="incident-grid">
          <article><span>Impact</span><strong>{incident.affected.join(' → ')}</strong><small>Score {incident.score}/100; critical checkout failures use a severity override.</small></article>
          <article><span>Estimated risk window</span><strong>{incident.status === 'RESOLVED' ? 'No active incident' : incident.riskMinutes === null ? 'Already impacting probes' : `~${incident.riskMinutes.toFixed(1)} minutes`}</strong><small>{incident.status === 'RESOLVED' ? 'Recovery passed five clean probe windows. Evidence below describes the original incident.' : incident.riskReason}</small></article>
          <article><span>Approved runbook</span><strong>{incident.runbook.replaceAll('_', ' ')}</strong><small>{incident.policy}</small></article>
          <article><span>Verification</span><strong>{incident.verificationPasses}/5 clean windows</strong><small>One repair attempt maximum. Repair confidence is not calibrated.</small></article>
        </div>
        <h3>Probable cause</h3><p>{incident.rca.hypothesis}</p>
        <p>{incident.rca.confidence === null ? 'Deterministic fallback; no AI confidence claimed.' : `Model self-reported confidence: ${Math.round(incident.rca.confidence * 100)}% (not calibrated).`}</p>
        <ul>{incident.rca.evidence.map(e => <li key={e}>{e}</li>)}</ul>
        <div className="lab-controls"><button disabled={busy || !data?.autonomous || incident.status !== 'AWAITING_APPROVAL'} onClick={() => void action('approve', { id: incident.id })}>Approve demo recovery</button><button disabled={busy || !data?.aiConfigured} onClick={() => void action('analyze')}>{busy ? 'Working…' : 'Ask local AI'}</button></div>
        {!data?.aiConfigured && <p className="run-note">Local AI is not connected. Detection, policy and recovery still work.</p>}
        {incident.after.length > 0 && <div className="table-wrap"><table><caption>Measured before / after repair</caption><thead><tr><th>Module</th><th>Errors before → after</th><th>Latency before → after</th></tr></thead><tbody>{incident.before.map(before => { const after = incident.after.find(s => s.service === before.service); return <tr key={before.service}><td>{before.service}</td><td>{before.errorRate}% → {after?.errorRate ?? '—'}%</td><td>{before.latencyMs.toFixed(2)} → {after?.latencyMs.toFixed(2) ?? '—'} ms</td></tr>; })}</tbody></table></div>}
        <h3>Incident timeline</h3><ol className="lab-timeline">{incident.timeline.map((event, i) => <li key={i}><time>{new Date(event.at).toLocaleTimeString()}</time> {event.message}</li>)}</ol>
      </div>}
      {Boolean(data?.history.length) && <details><summary>Previous incidents ({data!.history.length})</summary>{data!.history.map(item => <p key={item.id}>{item.id.slice(0, 8)} · {item.scenario} · {item.severity} · {item.status.replaceAll('_', ' ')} · {item.attempts} repair attempt</p>)}</details>}
    </div>
  </section>;
}

