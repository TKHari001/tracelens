CREATE TABLE IF NOT EXISTS app.sessions (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS app.runs (
  id uuid PRIMARY KEY,
  session_hash text NOT NULL REFERENCES app.sessions(token_hash) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  variant text NOT NULL CHECK (variant IN ('baseline','regressed','fixed')),
  status text NOT NULL CHECK (status IN ('queued','running','complete','incomplete','failed','interrupted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  environment text NOT NULL,
  traces jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(traces) = 'array'),
  error text,
  UNIQUE(session_hash, idempotency_key)
);
CREATE INDEX IF NOT EXISTS runs_session_created ON app.runs(session_hash, created_at DESC);
