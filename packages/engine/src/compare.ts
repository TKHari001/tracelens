import type { CapturedTrace, Comparison, ComparisonGroup, Journey, Run, SpanRecord } from '../../contracts/src/index.ts';

export class ComparisonError extends Error {}
const reject = (message: string): never => { throw new ComparisonError(message); };
const median = (values: number[]) => {
  const sorted = [...values].sort((a,b) => a-b);
  return sorted.length % 2 ? sorted[Math.floor(sorted.length/2)] : (sorted[sorted.length/2-1] + sorted[sorted.length/2])/2;
};

function validate(spans: SpanRecord[], traceId: string, externalParent?: string) {
  if (!spans.length || spans.length > 100) reject('Capture is empty or exceeds the span limit.');
  const map = new Map(spans.map(s => [s.spanId, s]));
  if (map.size !== spans.length) reject('Duplicate span IDs make this capture ambiguous.');
  if (spans.filter(s => externalParent ? s.parentSpanId === externalParent : s.parentSpanId === null).length !== 1) reject('Capture must contain exactly one request root.');
  for (const span of spans) {
    if(externalParent && span.parentSpanId===null)reject('Server capture is detached from its browser parent.');
    if (span.traceId !== traceId || !Number.isFinite(span.durationMs) || span.durationMs < 0) reject('Capture contains invalid trace identity or timing.');
    const visited = new Set<string>();
    let cursor: SpanRecord | undefined = span;
    while (cursor) {
      if (visited.has(cursor.spanId)) reject('Capture contains a parent cycle.');
      visited.add(cursor.spanId);
      if (cursor.parentSpanId === null || cursor.parentSpanId === externalParent) break;
      cursor = map.get(cursor.parentSpanId);
      if (!cursor) reject('Capture has a missing parent span.');
    }
  }
}

function group(samples: SpanRecord[][]) {
  const result = new Map<string, { operation: string; kind: SpanRecord['kind']; samples: SpanRecord[][] }>();
  samples.forEach((spans, index) => {
    const byId = new Map(spans.map(s => [s.spanId,s]));
    const path = (span: SpanRecord): string[] => {
      const parent = span.parentSpanId ? byId.get(span.parentSpanId) : undefined;
      return [...(parent ? path(parent) : []), `${span.kind}:${span.operation}`];
    };
    for (const span of spans) {
      // Match by operation ancestry and allowlisted template, never generated IDs or timestamps.
      const key = JSON.stringify([path(span), span.queryTemplate ?? null]);
      const value = result.get(key) ?? { operation: span.operation, kind: span.kind, samples: samples.map(() => [] as SpanRecord[]) };
      value.samples[index].push(span); result.set(key,value);
    }
  });
  return result;
}

function compareSamples(before: SpanRecord[][], after: SpanRecord[][]): ComparisonGroup[] {
  const left=group(before),right=group(after);
  return [...new Set([...left.keys(),...right.keys()])].sort().map(key => {
    const a=left.get(key),b=right.get(key);
    const metrics=(value: typeof a) => ({
      count: value ? median(value.samples.map(s => s.length)) : 0,
      errors: value ? median(value.samples.map(s => s.filter(x => x.status==='error').length)) : 0,
      total: value ? median(value.samples.map(s => s.reduce((total,x)=>total+x.durationMs,0))) : 0,
    });
    const x=metrics(a),y=metrics(b);
    const timingIncreased=!!a && !!b && y.total-x.total>=20 && y.total>=x.total*1.2;
    return { key,operation:(a??b)!.operation,kind:(a??b)!.kind,
      change: !a?'added':!b?'removed':x.count!==y.count||x.errors!==y.errors||timingIncreased?'changed':'unchanged',
      beforeCount:x.count,afterCount:y.count,beforeErrors:x.errors,afterErrors:y.errors,
      beforeTotalMs:x.total,afterTotalMs:y.total,timingIncreased,
      before:a?.samples.flat()??[],after:b?.samples.flat()??[] };
  });
}
function findings(report: Comparison) {
  const result: string[]=[];
  const delta=report.queryDelta;
  result.push(delta>0?`${delta} extra database queries per execution (${report.beforeQueries} → ${report.afterQueries}).`:delta<0?`${-delta} fewer database queries per execution (${report.beforeQueries} → ${report.afterQueries}).`:`Database query count is unchanged (${report.beforeQueries} → ${report.afterQueries}).`);
  const errors=report.groups.filter(g=>g.kind==='database').reduce((n,g)=>n+g.afterErrors,0);
  if(errors)result.push(`${errors} failed database ${errors===1?'operation':'operations'} per execution in the selected after capture.`);
  if(errors && report.afterHttp===200)result.unshift('Hidden failure: the after request returned HTTP 200 despite a recorded database error.');
  if(errors && report.afterHttp && report.afterHttp>=500)result.unshift('The after request reports an HTTP error; the database operation still fails.');
  for(const g of report.groups.filter(g=>g.kind==='database'&&g.afterCount>1&&g.afterCount>g.beforeCount))result.push(`${g.operation} repeats ${g.afterCount} times per execution. Inspect its SQL and spans below.`);
  if(report.output==='same')result.push('All measured cart output digests match.');
  else if(report.output==='different')result.push('Cart output changed between these runs.');
  if(report.groups.every(g=>g.change==='unchanged')&&report.output==='same'&&!errors)result.push('Matches baseline on recorded structure, query count, errors, and cart output.');
  return result;
}

export function compareRuns(before: Run, after: Run): Comparison {
  if(before.id===after.id)reject('Choose two different runs.');
  if(before.environment!==after.environment||before.dataset!==after.dataset||before.instrumentationVersion!==after.instrumentationVersion)reject('Runs must use the same environment, dataset, and instrumentation version.');
  for(const run of [before,after]) {
    if(run.status!=='complete'||run.traces.length!==3||run.traces.some(t=>!t.complete))reject('Only complete runs with three captured executions can be compared.');
    for(const t of run.traces){validate(t.spans,t.traceId);if(t.queryCount!==t.spans.filter(s=>s.kind==='database').length)reject('Stored query count does not match its evidence.');}
  }
  const all=[...before.traces,...after.traces];
  const validDigests=all.every(t=>t.appOutcome==='ok'&&typeof t.outputDigest==='string'&&/^[a-f0-9]{64}$/.test(t.outputDigest));
  const counts=(traces:CapturedTrace[])=>median(traces.map(t=>t.queryCount));
  const report:Comparison={kind:'runs',beforeId:before.id,afterId:after.id,samples:3,beforeQueries:counts(before.traces),afterQueries:counts(after.traces),queryDelta:counts(after.traces)-counts(before.traces),
    output:validDigests?new Set(all.map(t=>t.outputDigest)).size===1?'same':'different':'unavailable',
    findings:[],warnings:['Counts and group times are medians of three executions. Timings are descriptive, not a performance benchmark.','Parent and child durations overlap; do not add them together.'],groups:compareSamples(before.traces.map(t=>t.spans),after.traces.map(t=>t.spans))};
  report.findings=findings(report);return report;
}

export function compareJourneys(before:Journey,after:Journey):Comparison {
  if(before.id===after.id)reject('Choose two different requests.');
  if(!before.environment||!after.environment||!before.dataset||!after.dataset||!before.instrumentationVersion||!after.instrumentationVersion)reject('These older requests lack comparison metadata. Capture two new requests.');
  if(before.environment!==after.environment||before.dataset!==after.dataset||before.instrumentationVersion!==after.instrumentationVersion)reject('Requests must use the same environment, dataset, and instrumentation version.');
  validate(before.spans,before.traceId,before.browserSpanId);validate(after.spans,after.traceId,after.browserSpanId);
  const count=(j:Journey)=>j.spans.filter(s=>s.kind==='database').length;
  const warnings=['One execution per request. Differences describe observed evidence, not a proven root cause or performance benchmark.','Request comparisons show product counts; matching counts do not prove equal cart contents.'];
  if(!before.browser||!after.browser)warnings.push('Browser observation is missing for one or both requests; only server evidence is compared.');
  if([before,after].some(j=>j.browser&&(j.browser.status!==j.httpStatus||j.browser.productCount!==j.productCount)))warnings.push('Client-reported browser observations disagree with server evidence.');
  const report:Comparison={kind:'journeys',beforeId:before.id,afterId:after.id,samples:1,beforeQueries:count(before),afterQueries:count(after),queryDelta:count(after)-count(before),output:'unavailable',beforeHttp:before.httpStatus,afterHttp:after.httpStatus,beforeProducts:before.productCount,afterProducts:after.productCount,findings:[],warnings,groups:compareSamples([before.spans],[after.spans])};
  report.findings=findings(report);return report;
}
