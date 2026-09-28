import { useEffect, useState } from 'react';
import type { Run, Variant } from '../../../packages/contracts/src/index.ts';
import './runs.css';

async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data as T;
}
let session: Promise<unknown> | undefined;
export const startSession = () => session ??= request('/api/session', {}).catch(error => { session = undefined; throw error; });
const active = (run: Run) => run.status === 'queued' || run.status === 'running';

export function RunPanel() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sample, setSample] = useState(0);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        await startSession();
        const result = await request<Run[]>('/api/runs');
        if (cancelled) return;
        setRuns(result); setReady(true); setError('');
        setSelected(id => id && result.some(r => r.id === id) ? id : result[0]?.id ?? null);
        if (result.some(active)) timer = setTimeout(load, 1000);
      } catch (e) { if (!cancelled) { setError(e instanceof Error ? e.message : 'Could not load runs.'); setReady(false); } }
    }
    void load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [refresh]);
  async function run(variant: Variant) {
    setSubmitting(true); setError('');
    try {
      const result = await request<Run>('/api/runs', { variant, idempotencyKey: crypto.randomUUID() });
      setRuns(previous => [result, ...previous.filter(r => r.id !== result.id)]);
      setSelected(result.id); setSample(0); setRefresh(n => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the run.'); }
    finally { setSubmitting(false); }
  }
  const current = runs.find(r => r.id === selected);
  const captured = current?.traces[sample];
  const busy = submitting || runs.some(active);
  const latest = (variant: Variant) => runs.find(r => r.variant === variant && r.status === 'complete' && r.traces.every(t => t.complete && t.appOutcome === 'ok'));
  const baseline = latest('baseline');
  const digest = baseline?.traces[0]?.outputDigest;
  return <section className="panel runs-panel">
    <div className="panel-title"><div><h2>Capture real execution</h2><p>Each run executes the same cart three times. Counts come from saved query spans.</p></div><span className="tag">OPENTELEMETRY</span></div>
    <div className="run-controls">{(['baseline', 'regressed', 'fixed'] as const).map(variant => <button key={variant} className={variant === 'regressed' ? 'run-regressed' : ''} disabled={!ready || busy} onClick={() => void run(variant)}>Run {variant}</button>)}<button disabled={busy} onClick={() => { session = undefined; setRefresh(n => n + 1); }}>Refresh history</button></div>
    <p className="run-note">Fixed runs execute a prepared correction. Timings measure backend execution only; they are not a performance guarantee.</p>
    {error && <div role="alert" className="error">{error}</div>}
    <div className="run-cards">{(['baseline', 'regressed', 'fixed'] as const).map(variant => {
      const value = latest(variant);
      const counts = value?.traces.map(t => t.queryCount);
      const equal = digest && value?.traces.every(t => t.outputDigest === digest);
      return <article key={variant}><span>{variant}</span><strong>{counts ? counts.every(n => n === counts[0]) ? counts[0] : counts.join(' / ') : '—'}</strong><small>queries / execution</small><p>{value ? `Samples: ${counts!.join(' / ')}` : 'No successful capture yet'}</p>{value && <small>{!digest ? 'Capture a baseline to check output' : equal ? 'Same output as baseline' : 'Output differs from baseline'}</small>}</article>;
    })}</div>
    <div className="run-history"><label htmlFor="saved-run">Saved runs</label><select id="saved-run" value={selected ?? ''} onChange={e => { setSelected(e.target.value); setSample(0); }}><option value="" disabled>No saved runs</option>{runs.map(r => <option key={r.id} value={r.id}>{r.variant} · {r.status} · {new Date(r.createdAt).toLocaleTimeString()} · {r.id.slice(0, 8)}</option>)}</select></div>
    {!ready && !error && <p className="run-note" role="status">Connecting to run storage…</p>}
    {current && <div className="evidence"><div className="evidence-heading"><strong>{current.variant} · {current.status}</strong><span>{current.environment} · {current.dataset}</span></div>
      {active(current) && <p role="status">Capturing three executions…</p>}
      {current.error && <div role="alert" className="error">{current.error}</div>}
      {current.traces.length > 0 && <><div className="sample-controls">{current.traces.map((t, i) => <button key={t.traceId} aria-pressed={sample === i} onClick={() => setSample(i)}>Execution {i + 1}</button>)}</div>
      {captured && <><p>{captured.queryCount} queries · {captured.durationMs.toFixed(2)} ms · application {captured.appOutcome} · evidence {captured.complete ? 'complete' : 'incomplete'}</p><p className="digest">Output SHA-256: {captured.outputDigest ?? 'Unavailable: application failed'}</p><p className="digest">Trace ID: {captured.traceId}</p><div className="table-wrap"><table><thead><tr><th>OPERATION</th><th>STATUS</th><th className="money">DURATION</th><th>EVIDENCE</th></tr></thead><tbody>{captured.spans.map(span => <tr key={span.spanId}><td>{span.parentSpanId ? '↳ ' : ''}{span.operation}</td><td>{span.status}</td><td className="money">{span.durationMs.toFixed(2)} ms</td><td><details><summary>Inspect span</summary><code>{span.spanId}</code><p>Parent: {span.parentSpanId ?? 'root'}</p>{span.queryTemplate && <pre>{span.queryTemplate}</pre>}</details></td></tr>)}</tbody></table></div></>}
      </>}
    </div>}
  </section>;
}
