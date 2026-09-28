# API overview

All paths below are relative to the API origin, normally `http://127.0.0.1:3001`. This overview documents the checked-in implementation; source types and route validation are authoritative.

## Current dashboard

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/package/analyze` | Analyze in-memory files or a server-local path. |
| POST | `/api/v1/package/apply-fix` | Apply predefined substitutions, optionally write a file, then reanalyze. |
| POST | `/api/v1/chat` | Send `messages`, optional `provider`, and `context` to the provider adapter. |
| GET | `/api/v1/applications` | List network-database applications. |
| GET | `/api/v1/services` | List network-database services. |
| GET | `/api/v1/events` | List recent network-database events. |
| GET | `/api/v1/audit-logs` | List recent audit records. |
| GET | `/api/v1/remediations` | List remediation records. |
| GET | `/api/telemetry/stream` | Subscribe to server-sent events. |
| POST | `/api/telemetry/log` | Broadcast a log entry. |
| POST | `/api/telemetry/events` | Store an issue and start the demonstration analysis/plan flow. |
| GET | `/api/telemetry/issues` | List issues from network PostgreSQL. |

These routers do not require the guest session used by the trace routes. They must remain within a trusted local environment; see [security boundaries](../SECURITY.md).

### Analyze a fixture without uploading private source

From the repository root with the server running:

```powershell
$body = @{
  localPath = (Resolve-Path tests/fixtures/sample_bug.py).Path
  model = 'Anthropic Claude'
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3001/api/v1/package/analyze -ContentType application/json -Body $body
```

Alternatively supply `files: [{ path, content }]`, with optional `packageName`, `framework`, and `model`. If a local path is supplied, disk discovery supplies the analysis input. The response includes issues, subsystem results, health score, stage diagnostics, and an analysis status. Invalid file inputs can be represented in the result rather than only by an HTTP error.

Apply-fix accepts `filePath`, `originalCode`, `fixIds`, optional `writeToDisk`, and optional `localPath`. Keep `writeToDisk` false when reviewing a preview. A success flag or a list of applied fixes does not prove the replacement was appropriate or the target application passed tests.

## Retained trace and reliability API

Start with `POST /api/session` and preserve its `tracelens_session` cookie. Run, journey, comparison, and reliability routes validate ownership. Sessions last six hours.

| Method | Path | Purpose / input |
| --- | --- | --- |
| POST | `/api/session` | Create or reuse a guest session. |
| POST | `/api/demo/cart` | `mode`: `healthy`, `hidden-error`, or `honest-error`; requires a valid sampled W3C `traceparent`. |
| GET | `/api/journeys` | List owned saved journeys. |
| POST | `/api/journeys/:id/browser` | Attach the client's measured browser observation. |
| GET / POST | `/api/runs` | List or create runs; creation needs `variant` and UUID `idempotencyKey`. |
| GET | `/api/runs/:id` | Read an owned run. |
| GET | `/api/runs/:id/traces` | Read captured run evidence. |
| POST | `/api/comparisons` | `kind`: `runs` or `journeys`, plus UUID `beforeId` and `afterId`. |
| GET | `/api/reliability` | Read the session's controlled Reliability Lab snapshot. |
| POST | `/api/reliability/:action` | Run a validated demo action; see `reliability.ts` for payloads and approval rules. |
| GET | `/api/cart` | Read the reference cart. |

The request demo returns 20 products with HTTP 200 when healthy; the hidden SQL failure returns an empty cart with HTTP 200; honest error handling returns HTTP 503. An HTTP 200 alone is not evidence that all operations succeeded.

## Health and errors

- `GET /api/health`: status and timestamp.
- `GET /api/health/live`: process liveness.
- `GET /api/health/ready`: database query check; 503 when unavailable.
- Session routes can return 401, origin checks 403, missing owned evidence 404, malformed inputs 400, and capture limits 429.
- JSON bodies allow up to 10 MB under `/api/v1` and 4 KB elsewhere.
- SSE events include `connected`, `log.entry`, `trace.span`, `metric.update`, `analysis.output`, `remediation.output`, and issue-analysis/remediation events.

See `apps/api/src/rest.ts`, `telemetry.ts`, `run-routes.ts`, and shared contracts for exact response structures. The overview is not a claim of complete API validation or production isolation.
