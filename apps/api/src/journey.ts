import { ROOT_CONTEXT, trace, SpanKind, SpanStatusCode, TraceFlags } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { randomUUID } from 'node:crypto';
import { BoundedExporter } from './capture.ts';
import { loadCart, QUERIES, type QueryDb } from './cart.ts';
import type { Cart, Journey, JourneyMode } from '../../../packages/contracts/src/index.ts';

export function parseTraceparent(value: string | undefined) {
  const match = /^00-([a-f0-9]{32})-([a-f0-9]{16})-01$/.exec(value ?? '');
  if (!match || /^0+$/.test(match[1]) || /^0+$/.test(match[2])) return null;
  return { traceId: match[1], spanId: match[2], traceFlags: TraceFlags.SAMPLED, isRemote: true };
}

export async function executeJourney(db: QueryDb, mode: JourneyMode, parent: NonNullable<ReturnType<typeof parseTraceparent>>, environment = 'unspecified') {
  const exporter = new BoundedExporter();
  const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  const tracer = provider.getTracer('tracelens-http', 'journey-v1');
  const api = tracer.startSpan('POST /api/demo/cart', { kind: SpanKind.SERVER }, trace.setSpanContext(ROOT_CONTEXT, parent));
  const backend = tracer.startSpan('cart.load', {}, trace.setSpan(ROOT_CONTEXT, api));
  let cart: Cart | null = null;
  let failed = false;
  const failureSql = 'SELECT 1 / $1::integer AS demo_failure';
  try {
    const instrumented: QueryDb = { query: async (sql, args) => {
      const key = Object.entries(QUERIES).find(([, template]) => template === sql)?.[0];
      if (!key && sql !== failureSql) throw new Error('Unsupported query');
      const span = tracer.startSpan(sql === failureSql ? 'db.controlledFailure' : `db.${key}`, { kind: SpanKind.CLIENT, attributes: { 'query.template': sql } }, trace.setSpan(ROOT_CONTEXT, backend));
      try { return await db.query(sql, args); }
      catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        const code = (error as { code?: unknown })?.code;
        // Only SQLSTATE is retained. Driver messages may contain credentials or data.
        if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) span.setAttribute('db.error.code', code);
        throw error;
      } finally { span.end(); }
    } };
    if (mode !== 'healthy') await instrumented.query(failureSql, [0]);
    cart = await loadCart(instrumented);
  } catch {
    failed = true;
    backend.setStatus({ code: SpanStatusCode.ERROR });
    if (mode === 'hidden-error') cart = { dataset: 'cart-v1', products: [], totalCents: 0 };
  } finally { backend.end(); }
  const httpStatus = failed && mode !== 'hidden-error' ? 503 : 200;
  if (httpStatus >= 500) api.setStatus({ code: SpanStatusCode.ERROR });
  api.end();
  await provider.forceFlush(); await provider.shutdown();
  const spans = exporter.spans.sort((a, b) => a.spanId === api.spanContext().spanId ? -1 : b.spanId === api.spanContext().spanId ? 1 : a.spanId === backend.spanContext().spanId ? -1 : b.spanId === backend.spanContext().spanId ? 1 : a.startMs - b.startMs);
  const evidence: Journey = {
    id: randomUUID(), traceId: parent.traceId, browserSpanId: parent.spanId, mode,
    environment, dataset: 'cart-v1', instrumentationVersion: 'journey-v1',
    createdAt: new Date().toISOString(), httpStatus, productCount: cart?.products.length ?? null,
    spans, browser: null,
    finding: failed ? httpStatus === 200 ? 'Hidden failure: a database operation failed, but the API returned HTTP 200 with an empty cart.' : 'Failure reported: the database operation failed and the API returned HTTP 503.' : 'The request completed successfully. Products were loaded using two database queries.',
  };
  return { evidence, body: cart ?? { error: 'The cart could not be loaded because a database operation failed.' } };
}
