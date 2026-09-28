import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, connectionTimeoutMillis: 2000, statement_timeout: 1000,
  idleTimeoutMillis: 10000,
});
pool.on('error', () => console.error('An idle database connection failed.'));
