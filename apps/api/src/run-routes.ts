import { Router, type Request, type Response, type NextFunction } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { QueryDb } from './cart.ts';
import { RunService, RunError } from './runs.ts';
import { executeJourney, parseTraceparent } from './journey.ts';
import { requestLimit } from './limits.ts';
import { reliabilityRoutes } from './reliability.ts';
import { compareRuns, compareJourneys, ComparisonError } from '../../../packages/engine/src/compare.ts';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const tokenFrom = (req: Request) => req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('tracelens_session='))?.split('=')[1];
const bodySchema = z.object({ variant: z.enum(['baseline', 'regressed', 'fixed']), idempotencyKey: z.string().uuid() }).strict();
export function runRoutes(db: QueryDb, runs: RunService) {
  const router = Router();
  const sessionCreations = new Map<string, { count: number; expires: number }>();
  let journeyBusy = false;
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'POST') {
      if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
      const origin = req.get('origin');
      if (origin) {
        let allowed = false;
        try {
          const url = new URL(origin);
          allowed = process.env.NODE_ENV === 'production'
            ? origin === process.env.APP_ORIGIN
            : url.origin === `${req.protocol}://${req.get('host')}` || ['http://127.0.0.1:5173', 'http://localhost:5173'].includes(origin);
        } catch {}
        if (!allowed) return res.status(403).json({ error: 'Origin is not allowed.' });
      }
    }
    next();
  });
  router.post('/session', async (req, res) => {
    const existing = tokenFrom(req);
    if (existing && /^[a-f0-9]{64}$/.test(existing)) {
      const session = (await db.query('SELECT token_hash FROM app.sessions WHERE token_hash = $1 AND expires_at > now()', [hash(existing)])).rows[0];
      if (session) return res.json({ status: 'ready' });
    }
    const now = Date.now();
    for (const [ip, entry] of sessionCreations) if (entry.expires <= now) sessionCreations.delete(ip);
    const ip = req.ip || 'local';
    const entry = sessionCreations.get(ip) || { count: 0, expires: now + 3600000 };
    if (entry.count >= 10 || sessionCreations.size >= 1000) return res.status(429).json({ error: 'Too many new sessions. Try later.' });
    entry.count++; sessionCreations.set(ip, entry);
    const token = randomBytes(32).toString('hex');
    await db.query("INSERT INTO app.sessions(token_hash,expires_at) VALUES($1, now() + interval '6 hours')", [hash(token)]);
    res.cookie('tracelens_session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 6 * 3600000, path: '/' });
    return res.status(201).json({ status: 'ready' });
  });
  router.use(['/runs', '/demo', '/journeys', '/comparisons', '/reliability'], async (req, res, next) => {
    const token = tokenFrom(req);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Start a session before creating runs.' });
    const owner = hash(token);
    const session = (await db.query('SELECT token_hash FROM app.sessions WHERE token_hash = $1 AND expires_at > now()', [owner])).rows[0];
    if (!session) return res.status(401).json({ error: 'Session expired. Reload the page to start a new session.' });
    res.locals.owner = owner;
    next();
  });
  router.use(['/runs', '/demo', '/journeys', '/comparisons', '/reliability'], requestLimit(120, 60000, (_req, res) => res.locals.owner));
  router.use('/reliability', reliabilityRoutes(db));
  router.post('/comparisons', async (req,res) => {
    const input=z.object({kind:z.enum(['runs','journeys']),beforeId:z.string().uuid(),afterId:z.string().uuid()}).strict().safeParse(req.body);
    if(!input.success)return res.status(400).json({error:'Choose two saved requests or runs to compare.'});
    const {kind,beforeId,afterId}=input.data;
    if(kind==='runs')return res.json(compareRuns(await runs.get(res.locals.owner,beforeId),await runs.get(res.locals.owner,afterId)));
    const get=async(id:string)=>{const row=(await db.query('SELECT evidence FROM app.journeys WHERE id=$1 AND session_hash=$2',[id,res.locals.owner])).rows[0];if(!row)throw new RunError(404,'Request not found.');return row.evidence;};
    return res.json(compareJourneys(await get(beforeId),await get(afterId)));
  });
  router.post('/demo/cart', async (req, res) => {
    const input = z.object({ mode: z.enum(['healthy', 'hidden-error', 'honest-error']) }).strict().safeParse(req.body);
    const parent = parseTraceparent(req.get('traceparent'));
    if (!input.success || !parent) return res.status(400).json({ error: 'Select a supported demo mode and provide a valid sampled traceparent.' });
    if (journeyBusy) return res.status(429).json({ error: 'Another request is being captured. Retry shortly.' });
    journeyBusy = true;
    try {
      const counts = (await db.query("SELECT count(*) FILTER (WHERE session_hash = $1)::int AS total, count(*) FILTER (WHERE session_hash = $1 AND created_at > now() - interval '1 minute')::int AS recent, count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS global FROM app.journeys", [res.locals.owner])).rows[0];
      if (counts.total >= 30 || counts.recent >= 6 || counts.global >= 60) return res.status(429).json({ error: 'Request capture limit reached. Try later.' });
      const { evidence, body } = await executeJourney(db, input.data.mode, parent, runs.environment);
      await db.query('INSERT INTO app.journeys(id,session_hash,evidence) VALUES($1,$2,$3::jsonb)', [evidence.id, res.locals.owner, JSON.stringify(evidence)]);
      res.setHeader('X-Trace-Id', evidence.traceId);
      res.setHeader('X-Journey-Id', evidence.id);
      return res.status(evidence.httpStatus).json(body);
    } finally { journeyBusy = false; }
  });
  router.get('/journeys', async (_req, res) => {
    res.json((await db.query('SELECT evidence FROM app.journeys WHERE session_hash = $1 ORDER BY created_at DESC LIMIT 30', [res.locals.owner])).rows.map(row => row.evidence));
  });
  router.post('/journeys/:id/browser', async (req, res) => {
    const input = z.object({ durationMs: z.number().finite().min(0).max(300000), status: z.number().int().min(100).max(599), productCount: z.number().int().min(0).max(20).nullable() }).strict().safeParse(req.body);
    if (!input.success || !z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid browser observation.' });
    const saved = await db.query("UPDATE app.journeys SET evidence = jsonb_set(evidence, '{browser}', $3::jsonb) WHERE id = $1 AND session_hash = $2 AND evidence->'browser' = 'null'::jsonb RETURNING evidence", [req.params.id, res.locals.owner, JSON.stringify(input.data)]);
    if (!saved.rows.length) return res.status(404).json({ error: 'Request not found or browser observation already recorded.' });
    res.json(saved.rows[0].evidence);
  });
  router.get('/runs', async (_req, res) => res.json(await runs.list(res.locals.owner)));
  router.post('/runs', async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Choose baseline, regressed, or fixed and provide a UUID request key.' });
    const result = await runs.create(res.locals.owner, parsed.data.variant, parsed.data.idempotencyKey);
    res.status(['queued', 'running'].includes(result.status) ? 202 : 200).json(result);
  });
  router.get('/runs/:id', async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid run ID.' });
    res.json(await runs.get(res.locals.owner, req.params.id));
  });
  router.get('/runs/:id/traces', async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid run ID.' });
    res.json((await runs.get(res.locals.owner, req.params.id)).traces);
  });
  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if(error instanceof ComparisonError){res.status(422).json({error:error.message});return;}
    res.status(error instanceof RunError ? error.code : 503).json({ error: error instanceof RunError ? error.message : 'Run storage is unavailable. Check the database and run db:setup.' });
  });
  return router;
}
