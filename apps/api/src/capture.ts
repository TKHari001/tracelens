import { ROOT_CONTEXT, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, type SpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import { createHash } from 'node:crypto';
import { loadCart, QUERIES, type QueryDb } from './cart.ts';
import type { CapturedTrace, SpanRecord, Variant } from '../../../packages/contracts/src/index.ts';

export class BoundedExporter implements SpanExporter {
  spans: SpanRecord[] = [];
  dropped = false;
  export(spans: ReadableSpan[], done: (result: ExportResult) => void) {
    for (const span of spans) {
      if (this.spans.length >= 100) { this.dropped = true; continue; }
      const template = span.attributes['query.template'];
      const code = span.attributes['db.error.code'];
      this.spans.push({
        traceId: span.spanContext().traceId, spanId: span.spanContext().spanId,
        parentSpanId: span.parentSpanContext?.spanId ?? null, operation: span.name,
        kind: span.kind === SpanKind.CLIENT ? 'database' : 'internal',
        startMs: span.startTime[0] * 1000 + span.startTime[1] / 1e6,
        durationMs: span.duration[0] * 1000 + span.duration[1] / 1e6,
        status: span.status.code === SpanStatusCode.ERROR ? 'error' : 'ok',
        ...(typeof template === 'string' ? { queryTemplate: template } : {}),
        ...(typeof code === 'string' ? { errorCode: code } : {}),
      });
    }
    done({ code: ExportResultCode.SUCCESS });
  }
  async shutdown() {}
}

export async function captureCart(db: QueryDb, variant: Variant, deadline = Date.now() + 15000): Promise<CapturedTrace> {
  const exporter = new BoundedExporter();
  const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  const tracer = provider.getTracer('tracelens-cart', 'manual-v1');
  const root = tracer.startSpan('cart.request', {}, ROOT_CONTEXT);
  const business = tracer.startSpan('cart.load', {}, trace.setSpan(ROOT_CONTEXT, root));
  const parent = trace.setSpan(ROOT_CONTEXT, business);
  let digest: string | null = null;
  let appOutcome: 'ok' | 'error' = 'ok';
  let attemptedQueries = 0;
  try {
    const cart = await loadCart({ query: async (sql, values) => {
      if (Date.now() >= deadline) throw new Error('Run deadline exceeded');
      const entry = Object.entries(QUERIES).find(([, template]) => template === sql);
      if (!entry) throw new Error('Unapproved query template');
      attemptedQueries++;
      const span = tracer.startSpan(`db.${entry[0]}`, { kind: SpanKind.CLIENT, attributes: { 'query.template': entry[1] } }, parent);
      try { return await db.query(sql, values); }
      catch (error) { span.setStatus({ code: SpanStatusCode.ERROR }); throw error; }
      finally { span.end(); }
    } }, variant);
    if (Date.now() >= deadline) throw new Error('Run deadline exceeded');
    digest = createHash('sha256').update(JSON.stringify(cart)).digest('hex');
  } catch {
    appOutcome = 'error';
    business.setStatus({ code: SpanStatusCode.ERROR }); root.setStatus({ code: SpanStatusCode.ERROR });
  } finally { business.end(); root.end(); }
  await provider.forceFlush();
  await provider.shutdown();
  const depth = (span: SpanRecord): number => !span.parentSpanId ? 0 : span.kind === 'database' ? 2 : 1;
  const spans = exporter.spans.sort((a, b) => depth(a) - depth(b) || a.startMs - b.startMs);
  const ids = new Set(spans.map(s => s.spanId));
  const complete = !exporter.dropped && spans.length === attemptedQueries + 2 &&
    spans.every(s => s.traceId === root.spanContext().traceId && (!s.parentSpanId || ids.has(s.parentSpanId)));
  return { traceId: root.spanContext().traceId, spans, queryCount: spans.filter(s => s.kind === 'database').length,
    durationMs: spans.find(s => s.spanId === root.spanContext().spanId)?.durationMs ?? 0,
    outputDigest: digest, appOutcome, complete };
}
