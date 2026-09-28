import { z } from 'zod';

export const productSchema = z.object({
  id: z.number().int().positive(), name: z.string(), priceCents: z.number().int().nonnegative(),
  seller: z.object({ id: z.number().int().positive(), name: z.string() }),
});
export const cartSchema = z.object({ dataset: z.literal('cart-v1'), products: z.array(productSchema), totalCents: z.number().int().nonnegative() });
export type Cart = z.infer<typeof cartSchema>;
export type Variant = 'baseline' | 'regressed' | 'fixed';
export type SpanRecord = { traceId: string; spanId: string; parentSpanId: string | null; operation: string; kind: 'internal' | 'database'; startMs: number; durationMs: number; status: 'ok' | 'error'; queryTemplate?: string; errorCode?: string };
export type CapturedTrace = { traceId: string; spans: SpanRecord[]; queryCount: number; durationMs: number; outputDigest: string | null; appOutcome: 'ok' | 'error'; complete: boolean };
export type RunStatus = 'queued' | 'running' | 'complete' | 'incomplete' | 'failed' | 'interrupted';
export type Run = { id: string; variant: Variant; status: RunStatus; createdAt: string; dataset: 'cart-v1'; instrumentationVersion: 'manual-v1'; environment: string; traces: CapturedTrace[]; error: string | null };
export type JourneyMode = 'healthy' | 'hidden-error' | 'honest-error';
export type BrowserObservation = { durationMs: number; status: number; productCount: number | null };
export type Journey = { id: string; traceId: string; browserSpanId: string; mode: JourneyMode; createdAt: string; httpStatus: number; productCount: number | null; spans: SpanRecord[]; browser: BrowserObservation | null; finding: string; environment?: string; dataset?: string; instrumentationVersion?: string };
export type ComparisonGroup = { key: string; operation: string; kind: SpanRecord['kind']; change: 'added' | 'removed' | 'changed' | 'unchanged'; beforeCount: number; afterCount: number; beforeErrors: number; afterErrors: number; beforeTotalMs: number; afterTotalMs: number; timingIncreased: boolean; before: SpanRecord[]; after: SpanRecord[] };
export type Comparison = { kind: 'runs' | 'journeys'; beforeId: string; afterId: string; samples: number; beforeQueries: number; afterQueries: number; queryDelta: number; output: 'same' | 'different' | 'unavailable'; beforeHttp?: number; afterHttp?: number; beforeProducts?: number | null; afterProducts?: number | null; findings: string[]; warnings: string[]; groups: ComparisonGroup[] };
