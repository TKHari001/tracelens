import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { PGlite } from '@electric-sql/pglite';
import { loadCart } from '../apps/api/src/cart.ts';
import { createApp } from '../apps/api/src/app.ts';
import { cartSchema } from '../packages/contracts/src/index.ts';

test('seed is repeatable; actual SQL returns 20 products, five sellers, and a correct total in two queries', async () => {
  const db = new PGlite();
  try {
    const sql = await readFile(new URL('../apps/api/migrations/001_demo.sql', import.meta.url), 'utf8');
    await db.exec(sql); await db.exec(sql);
    let count = 0;
    const cart = cartSchema.parse(await loadCart({ query: async (sql, args) => { count++; return db.query(sql, args); } }));
    assert.equal(count, 2);
    assert.equal(cart.products.length, 20);
    assert.equal(new Set(cart.products.map(p => p.seller.id)).size, 5);
    assert.equal(cart.totalCents, 36250);
    assert.deepEqual(cart.products.map(p => p.id), Array.from({ length: 20 }, (_, i) => i + 1));
    const server = createApp(db).listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      const base = `http://127.0.0.1:${address.port}`;
      const response = await fetch(base + '/api/cart');
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), cart);
      assert.equal((await fetch(base + '/api/health/ready')).status, 200);
      assert.equal((await fetch(base + '/api/missing')).status, 404);
      assert.equal((await fetch(base + '/')).status, 200);
    } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
  } finally { await db.close(); }
});

test('unavailable database returns actionable 503 without leaking credentials', async () => {
  const server = createApp({ query: async () => { throw new Error('postgres://secret-password@host'); } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(base + '/api/health/live')).status, 200);
    for (const path of ['/api/cart', '/api/health/ready']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 503);
      const text = await response.text();
      assert.match(text, /db:setup/);
      assert.doesNotMatch(text, /secret-password/);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});
