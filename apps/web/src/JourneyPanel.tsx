import { useEffect, useState } from 'react';
import type { Journey, JourneyMode } from '../../../packages/contracts/src/index.ts';
import './journey.css';
import { startSession as ensureSession } from './RunPanel.tsx';
function hex(bytes: number) { return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), n => n.toString(16).padStart(2, '0')).join(''); }

type IncidentBrief = {
  severity: 'SEV-1' | 'SEV-2' | 'SEV-4';
  title: string;
  countdown: string;
  confidence: string;
  action: string;
  policy: string;
  evidence: string[];
};

function incidentBrief(journey: Journey, failed: boolean, queryCount: number): IncidentBrief {
  const hiddenFailure = failed && journey.httpStatus === 200;
  const reportedFailure = journey.httpStatus >= 500;
  if (reportedFailure) return {
    severity: 'SEV-1',
    title: 'Critical incident: customer request is failing',
    countdown: 'This request has failed. More samples are needed to estimate a risk window.',
    confidence: 'Not measured; no repair has been attempted',
    action: 'Recommend approved rollback or database fix runbook',
    policy: 'Human approval required before any risky change',
    evidence: ['HTTP 503 reached the browser', 'Database span has an error', 'Blast radius can affect checkout/cart users'],
  };
  if (hiddenFailure) return {
    severity: 'SEV-2',
    title: 'Silent incident: success response hides a database failure',
    countdown: 'Risk estimate: user trust impact starts immediately',
    confidence: 'Not measured; no repair has been attempted',
    action: 'Recommend investigation runbook and convert silent catch into honest error handling',
    policy: 'No auto-repair. Evidence is shown, engineer decides the code fix',
    evidence: ['HTTP 200 returned to the browser', 'Database query failed inside the backend', 'Cart became empty even though the request looked successful'],
  };
  return {
    severity: 'SEV-4',
    title: 'Healthy request: no active incident',
    countdown: 'No active incident countdown',
    confidence: 'Repair confidence not needed',
    action: 'Keep monitoring and compare against future captures',
    policy: 'Automation stays idle because the request is healthy',
    evidence: [`${queryCount} database queries completed`, 'Backend operation completed', 'Browser received product data'],
  };
}

export function JourneyPanel() {
  const [mode, setMode] = useState<JourneyMode>('healthy');
  const [history, setHistory] = useState<Journey[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureSession();
        const response = await fetch('/api/journeys');
        if (!response.ok) throw new Error('Could not load request history. Reload to renew your session.');
        const data = await response.json() as Journey[];
        if (!cancelled) { setHistory(data); setSelected(id => data.some(j => j.id === id) ? id : data[0]?.id ?? ''); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Connection failed.'); }
    })();
    return () => { cancelled = true; };
  }, [refresh]);
  async function load() {
    setBusy(true); setError('');
    try {
      await ensureSession();
      const traceId = hex(16), spanId = hex(8);
      const start = performance.now();
      const response = await fetch('/api/demo/cart', { method: 'POST', headers: { 'Content-Type': 'application/json', traceparent: `00-${traceId}-${spanId}-01` }, body: JSON.stringify({ mode }) });
      const body = await response.json();
      const durationMs = performance.now() - start;
      const id = response.headers.get('X-Journey-Id');
      if (!id) throw new Error(body.error || 'The response has no saved trace evidence.');
      if (response.headers.get('X-Trace-Id') !== traceId) throw new Error('Response trace ID did not match this browser request.');
      setSelected(id);
      const observed = await fetch(`/api/journeys/${id}/browser`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ durationMs, status: response.status, productCount: Array.isArray(body.products) ? body.products.length : null }) });
      if (!observed.ok) throw new Error('Backend evidence was saved, but browser timing could not be attached. Refresh history to inspect it.');
      const saved = await observed.json() as Journey;
      setHistory(previous => [saved, ...previous.filter(j => j.id !== saved.id)]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed. No evidence available.'); }
    finally { setBusy(false); setRefresh(n => n + 1); }
  }
  const current = history.find(j => j.id === selected);
  const api = current?.spans.find(s => s.operation === 'POST /api/demo/cart');
  const backend = current?.spans.find(s => s.operation === 'cart.load');
  const queries = current?.spans.filter(s => s.kind === 'database') ?? [];
  const failed = queries.some(s => s.status === 'error');
  const incident = current ? incidentBrief(current, failed, queries.length) : null;
  return <section className="panel journey-panel">
    <div className="panel-title"><div><h2>One click. The whole request.</h2><p>A live browser request, connected to the backend and database by one trace ID.</p></div><span className="tag">LIVE REQUEST</span></div>
    <div className="journey-controls"><label htmlFor="scenario">Demo scenario</label><select id="scenario" value={mode} disabled={busy} onChange={e => setMode(e.target.value as JourneyMode)}><option value="healthy">Working cart</option><option value="hidden-error">Hidden database failure</option><option value="honest-error">Correct error handling</option></select><button disabled={busy} onClick={() => void load()}>{busy ? 'Following request…' : 'Load cart & trace'}</button></div>
    <p className="run-note">Controlled demo: failure modes execute a safe read-only division-by-zero query. Correct error handling reports the failure; it does not repair the database operation.</p>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="run-history"><label htmlFor="journey-history">Request history</label><select id="journey-history" value={selected} disabled={busy} onChange={e => setSelected(e.target.value)}><option value="">Select a request</option>{history.map(j => <option value={j.id} key={j.id}>{j.mode} · HTTP {j.httpStatus} · {new Date(j.createdAt).toLocaleTimeString()}</option>)}</select><button disabled={busy} onClick={() => setRefresh(n => n + 1)}>Refresh requests</button></div>
    {!current && <div className="empty">Choose a scenario and load the cart to follow a real request.</div>}
    {current && <div className="journey-evidence"><div className={'finding ' + (failed ? 'finding-error' : '')}><strong>{current.finding}</strong></div>
      {incident && <section className={`incident-card incident-${incident.severity.toLowerCase()}`} aria-label="Incident intelligence">
        <div className="incident-head"><div><span>REQUEST RELIABILITY · RULE-BASED</span><h3>{incident.title}</h3></div><strong>{incident.severity}</strong></div>
        <div className="incident-grid">
          <article><span>Time-to-impact</span><strong>{incident.countdown}</strong></article>
          <article><span>Safe action</span><strong>{incident.action}</strong></article>
          <article><span>Self-heal policy</span><strong>{incident.policy}</strong></article>
          <article><span>Confidence</span><strong>{incident.confidence}</strong></article>
        </div>
        <ul>{incident.evidence.map(item => <li key={item}>{item}</li>)}</ul>
      </section>}
      <div className="journey-flow">
        <article><span>01 · BROWSER</span><h3>Load cart click</h3><strong>{current.browser ? current.browser.productCount === null ? 'Error shown' : `${current.browser.productCount} products received` : 'Observation missing'}</strong><p>{current.browser ? `${current.browser.durationMs.toFixed(2)} ms · HTTP ${current.browser.status}` : 'Backend trace exists; browser timing was not saved.'}</p><small>Measured in the browser</small></article>
        <article><span>02 · API</span><h3>POST /api/demo/cart</h3><strong>HTTP {current.httpStatus}</strong><p>{api?.durationMs.toFixed(2)} ms · {api?.status}</p><small>Server response status</small></article>
        <article className={backend?.status === 'error' ? 'step-error' : ''}><span>03 · BACKEND</span><h3>cart.load</h3><strong>{backend?.status === 'error' ? 'Operation failed' : 'Cart loaded'}</strong><p>{backend?.durationMs.toFixed(2)} ms</p><small>{failed && current.httpStatus === 200 ? 'Failure caught; empty cart returned' : 'Instrumented application operation'}</small></article>
        <article className={failed ? 'step-error' : ''}><span>04 · DATABASE</span><h3>{queries.length} {queries.length === 1 ? 'query' : 'queries'}</h3><strong>{failed ? 'Query failed' : 'Queries succeeded'}</strong><p>{queries.find(s => s.errorCode)?.errorCode ? `SQLSTATE ${queries.find(s => s.errorCode)!.errorCode}` : 'Recorded query spans'}</p><small>Expand the evidence below</small></article>
      </div>
      <p className="digest">Shared trace ID: {current.traceId}</p><p className="run-note">Browser duration includes transport, server work, response parsing, and evidence storage. Server and query timings are nested; do not add them together. Saved browser observations are client-reported.</p>
      <details className="span-evidence"><summary>Inspect connected span evidence</summary><p className="digest">Browser parent span: {current.browserSpanId}</p>{current.spans.map(s => <article key={s.spanId}><strong>{s.operation} · {s.status} · {s.durationMs.toFixed(2)} ms</strong><p className="digest">Span {s.spanId} → parent {s.parentSpanId}</p>{s.queryTemplate && <pre>{s.queryTemplate}</pre>}{s.errorCode && <p>SQLSTATE {s.errorCode}{s.errorCode === '22012' ? ' — division by zero' : ''}</p>}</article>)}</details>
    </div>}
  </section>;
}
