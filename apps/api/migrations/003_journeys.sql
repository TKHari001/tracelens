CREATE TABLE IF NOT EXISTS app.journeys (
  id uuid PRIMARY KEY,
  session_hash text NOT NULL REFERENCES app.sessions(token_hash) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS journeys_session_created ON app.journeys(session_hash, created_at DESC);
