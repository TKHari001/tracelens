CREATE SCHEMA IF NOT EXISTS telemetry;

CREATE TABLE IF NOT EXISTS telemetry.issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DETECTED',
    first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    occurrences INT NOT NULL DEFAULT 1,
    affected_service TEXT,
    affected_file TEXT,
    stack_trace TEXT,
    root_cause TEXT,
    confidence INT,
    user_impact TEXT
);

CREATE TABLE IF NOT EXISTS telemetry.remediations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES telemetry.issues(id) ON DELETE CASCADE,
    ai_model TEXT NOT NULL,
    confidence INT NOT NULL,
    proposed_action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PLAN_GENERATED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    approver TEXT
);
