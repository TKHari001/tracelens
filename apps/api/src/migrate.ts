import { readFile } from 'node:fs/promises';
import { pool } from './db.ts';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env before running db:setup.');
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(736251)');
    await client.query('CREATE SCHEMA IF NOT EXISTS app');
    await client.query('CREATE TABLE IF NOT EXISTS app.migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const name of ['001_demo.sql', '002_runs.sql', '003_journeys.sql', '004_issues.sql', '005_full_schema.sql']) {
    const existing = await client.query('SELECT name FROM app.migrations WHERE name = $1', [name]);
    if (!existing.rowCount) {
      await client.query(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
      await client.query('INSERT INTO app.migrations(name) VALUES ($1)', [name]);
    }
    }
    await client.query('COMMIT');
    console.log('Database ready: cart-v1 with 20 products and 5 sellers.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
} finally { await pool.end(); }
