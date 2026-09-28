CREATE SCHEMA IF NOT EXISTS telemetry;

CREATE TABLE IF NOT EXISTS telemetry.applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    environment TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telemetry.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID REFERENCES telemetry.applications(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Frontend', 'Backend', 'Database'
    status TEXT NOT NULL DEFAULT 'Healthy',
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telemetry.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID REFERENCES telemetry.applications(id) ON DELETE CASCADE,
    service_id UUID REFERENCES telemetry.services(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'LOG', 'METRIC', 'TRACE', 'EXCEPTION'
    severity TEXT NOT NULL,
    payload JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telemetry.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    user_id TEXT, -- Can be expanded later with real RBAC
    target_id UUID,
    details JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telemetry.policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL,
    environment TEXT NOT NULL,
    severity TEXT NOT NULL,
    requires_approval BOOLEAN NOT NULL DEFAULT true,
    confidence_threshold INT NOT NULL DEFAULT 90
);

-- Seed an application for testing
INSERT INTO telemetry.applications (id, name, environment)
VALUES ('00000000-0000-0000-0000-000000000001', 'Cart Demo Application', 'Development')
ON CONFLICT DO NOTHING;

INSERT INTO telemetry.services (id, app_id, name, type)
VALUES 
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Frontend Web', 'Frontend'),
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Payment Gateway API', 'Backend'),
('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'PostgreSQL Primary', 'Database')
ON CONFLICT DO NOTHING;
