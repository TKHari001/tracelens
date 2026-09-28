import express, { type Request, type Response, type NextFunction } from 'express';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { loadCart, type QueryDb } from './cart.ts';
import { RunService } from './runs.ts';
import { runRoutes } from './run-routes.ts';
import { telemetryRouter } from './telemetry.ts';
import { restRouter } from './rest.ts';

export function createApp(db: QueryDb, runs?: RunService) {
  const app = express();

  app.disable('x-powered-by');

  // Basic security and headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Body parsing: allow 10mb for code analysis in /api/v1, 4kb elsewhere
  app.use('/api/v1', express.json({ limit: '10mb' }));
  app.use(express.json({ limit: '4kb' }));
  app.use(express.urlencoded({ extended: true, limit: '4kb' }));

  // Mount API routers
  app.use('/api/telemetry', telemetryRouter);
  app.use('/api/v1', restRouter);

  const runService = runs || new RunService(db, 'default');
  app.use('/api', runRoutes(db, runService));

  // Cart endpoint
  app.get('/api/cart', async (_req: Request, res: Response) => {
    try {
      const cart = await loadCart(db);
      res.json(cart);
    } catch {
      res.status(503).json({ error: 'Database unavailable. Did you run pnpm db:setup?' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Ready endpoint for test suites
  app.get('/api/health/ready', async (_req: Request, res: Response) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ error: 'Database unavailable. Did you run pnpm db:setup?' });
    }
  });

  // Live endpoint for test suites
  app.get('/api/health/live', (_req: Request, res: Response) => {
    res.json({ status: 'live' });
  });

  // Serve static dist in production/preview if available
  const distPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(join(distPath, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}