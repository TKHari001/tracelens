import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureCart } from '../apps/api/src/capture.ts';
import { executeJourney, parseTraceparent } from '../apps/api/src/journey.ts';
import { pool } from '../apps/api/src/db.ts';

test('PostgreSQL server adapter: real 2/21/2 captures and SQLSTATE 22012', async () => {
  assert.ok(process.env.DATABASE_URL, 'Set DATABASE_URL to a dedicated migrated demo database.');
  try {
    const traces = [];
    for (const variant of ['baseline','regressed','fixed'] as const) traces.push(await captureCart(pool, variant));
    assert.deepEqual(traces.map(t => t.queryCount), [2,21,2]);
    assert.ok(traces.every(t => t.complete && t.appOutcome === 'ok'));
    assert.equal(new Set(traces.map(t => t.outputDigest)).size, 1);
    const parent = parseTraceparent('00-11111111111111111111111111111111-1111111111111111-01')!;
    for (const mode of ['hidden-error','honest-error'] as const) {
      const result = await executeJourney(pool, mode, parent);
      assert.equal(result.evidence.httpStatus, mode === 'hidden-error' ? 200 : 503);
      assert.equal(result.evidence.spans.find(s => s.kind === 'database')?.errorCode, '22012');
    }
  } finally { await pool.end(); }
});
