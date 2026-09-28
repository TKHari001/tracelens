import type { RequestHandler } from 'express';

// Bounded fixed-window limiter for this single-instance synthetic sandbox.
export function requestLimit(limit: number, windowMs: number, key: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => string, now = Date.now): RequestHandler {
  const entries = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const time = now();
    for (const [id, value] of entries) if (value.until <= time) entries.delete(id);
    const id = key(req, res);
    const entry = entries.get(id) ?? { count: 0, until: time + windowMs };
    if ((!entries.has(id) && entries.size >= 2000) || entry.count >= limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.until - time) / 1000))));
      res.status(429).json({ error: 'Request limit reached. Please wait and retry.' });
      return;
    }
    entry.count++; entries.set(id, entry); next();
  };
}
