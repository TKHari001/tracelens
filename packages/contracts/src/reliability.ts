export type Scenario = 'worker' | 'payment' | 'database';
export type ServiceName = 'gateway' | 'orders' | 'payment' | 'database' | 'worker';
export type Severity = 'SEV-0' | 'SEV-1' | 'SEV-2' | 'SEV-3' | 'SEV-4';
export type IncidentState = 'AWAITING_APPROVAL' | 'REMEDIATION_PROPOSED' | 'REMEDIATING' | 'VERIFYING' | 'RESOLVED' | 'ESCALATED';
export type Sample = { at: number; service: ServiceName; errorRate: number; latencyMs: number; error: string | null };
export type ReliabilityIncident = {
  id: string; scenario: Scenario; severity: Severity; score: number; status: IncidentState;
  root: ServiceName; affected: ServiceName[]; evidence: string[]; runbook: string;
  policy: string; attempts: number; verificationPasses: number; before: Sample[]; after: Sample[];
  timeline: { at: number; message: string }[];
  rca: { source: 'rules' | 'ollama'; hypothesis: string; confidence: number | null; evidence: string[] };
  riskMinutes: number | null; riskReason: string; forceFailedRecovery: boolean;
};
export type ReliabilitySnapshot = {
  mode: string; autonomous: boolean; samples: Sample[]; incident: ReliabilityIncident | null;
  history: ReliabilityIncident[]; aiConfigured: boolean;
};
