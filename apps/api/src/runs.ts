import { randomUUID } from 'node:crypto';
import type { QueryDb } from './cart.ts';
import { captureCart } from './capture.ts';
import type { CapturedTrace, Run, Variant } from '../../../packages/contracts/src/index.ts';

export class RunError extends Error { constructor(public code: number, message: string) { super(message); } }
export function toRun(row: any): Run {
  return { id: row.id, variant: row.variant, status: row.status, createdAt: new Date(row.created_at).toISOString(),
    dataset: 'cart-v1', instrumentationVersion: 'manual-v1', environment: row.environment, traces: row.traces, error: row.error };
}
export class RunService {
  private busy = false;
  private stopped = false;
  private pending: Promise<void> = Promise.resolve();
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private cleaning = false;
  constructor(private db: QueryDb, public readonly environment: string) {}
  async initialize() {
    await this.db.query("UPDATE app.runs SET status = 'interrupted', error = 'The server restarted before capture finished. Run again.' WHERE status IN ('queued','running')");
    await this.cleanup();
    this.cleanupTimer = setInterval(() => { void this.cleanup().catch(() => console.error('Session cleanup unavailable; will retry.')); }, 60000).unref();
  }
  async cleanup() {
    if (this.cleaning || this.busy) return;
    this.cleaning = true;
    try { await this.db.query("DELETE FROM app.sessions WHERE expires_at < now() - interval '1 minute' AND NOT EXISTS (SELECT 1 FROM app.runs WHERE session_hash = app.sessions.token_hash AND status IN ('queued','running'))"); }
    finally { this.cleaning = false; }
  }
  async stop() { this.stopped = true; clearInterval(this.cleanupTimer); await this.pending; }
  async list(owner: string) { return (await this.db.query('SELECT * FROM app.runs WHERE session_hash = $1 ORDER BY created_at DESC LIMIT 30', [owner])).rows.map(toRun); }
  async get(owner: string, id: string) {
    const row = (await this.db.query('SELECT * FROM app.runs WHERE session_hash = $1 AND id = $2', [owner, id])).rows[0];
    if (!row) throw new RunError(404, 'Run not found.');
    return toRun(row);
  }
  async create(owner: string, variant: Variant, key: string) {
    const existing = (await this.db.query('SELECT * FROM app.runs WHERE session_hash = $1 AND idempotency_key = $2', [owner, key])).rows[0];
    if (existing) {
      if (existing.variant !== variant) throw new RunError(409, 'This request key was already used for a different variant.');
      return toRun(existing);
    }
    if (this.busy || this.stopped) throw new RunError(429, 'A run is already active. Wait for it to finish and retry.');
    this.busy = true;
    try {
      const counts = (await this.db.query("SELECT count(*) FILTER (WHERE session_hash = $1)::int AS total, count(*) FILTER (WHERE session_hash = $1 AND created_at > now() - interval '1 minute')::int AS recent, count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS global FROM app.runs", [owner])).rows[0];
      if (counts.total >= 30 || counts.recent >= 6 || counts.global >= 60) throw new RunError(429, 'Run limit reached. Try later with this session.');
      const row = (await this.db.query("INSERT INTO app.runs(id,session_hash,idempotency_key,variant,status,environment) VALUES($1,$2,$3,$4,'queued',$5) RETURNING *", [randomUUID(), owner, key, variant, this.environment])).rows[0];
      this.pending = this.execute(row.id, variant).finally(() => { this.busy = false; });
      return toRun(row);
    } catch (error) { this.busy = false; throw error; }
  }
  private async execute(id: string, variant: Variant) {
    try {
      await this.db.query("UPDATE app.runs SET status = 'running' WHERE id = $1", [id]);
      const deadline = Date.now() + 15000;
      const traces: CapturedTrace[] = [];
      for (let sample = 0; sample < 3 && Date.now() < deadline; sample++) traces.push(await captureCart(this.db, variant, deadline));
      const complete = traces.length === 3 && traces.every(t => t.complete) && Buffer.byteLength(JSON.stringify(traces)) <= 1024 * 1024;
      // Evidence completeness is separate from application success. One UPDATE atomically saves all evidence and terminal state.
      await this.db.query('UPDATE app.runs SET status = $2, traces = $3::jsonb, error = $4 WHERE id = $1',
        [id, complete ? 'complete' : 'incomplete', JSON.stringify(traces), complete ? null : 'Capture did not finish within the evidence limits.']);
    } catch {
      try { await this.db.query("UPDATE app.runs SET status = 'failed', error = 'Capture could not be saved. Check the database and retry.' WHERE id = $1", [id]); }
      catch { console.error('Run persistence unavailable; restart will mark unfinished runs interrupted.'); }
    }
  }
}
