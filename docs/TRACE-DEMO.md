> Historical README preserved for the original trace demonstration. Its phase status, test counts, and UI instructions predate the current dashboard. See [current README](../README.md) and [verification](VERIFICATION.md).

# TraceLens — X-Ray Vision for Running Applications

Phases 1–4 are implemented locally. See [DEPLOYMENT.md](../DEPLOYMENT.md) and [DEMO.md](../DEMO.md) for Phase 5 preparation. Local build and 13 tests pass. Three automated HTTP rehearsals passed during Phase 5 preparation. Public deployment and PostgreSQL server validation remain pending.

## Compare saved evidence

The **What changed?** panel supports two modes:

- **Connected requests:** capture two new requests, refresh comparison choices, and compare their HTTP status, product count, operation errors, and SQL evidence. The hidden failure is highlighted even when both HTTP responses are 200. Old request records without environment/version metadata are rejected; recapture them.
- **Three-sample query runs:** capture baseline, regressed, and fixed runs. Compare baseline to regressed to see 19 extra queries and the 20 repeated seller lookups per execution. Compare baseline to fixed to verify two queries and matching cart output digests.

Expand a changed operation to inspect its before/after trace IDs, span IDs, parent IDs, SQL templates, and SQLSTATE. Counts and group durations are medians for three-sample runs. Timing increases are highlighted only when they exceed both 20% and 20 ms. Parent/child time overlaps; never sum the whole trace tree.

The pure engine matches operation ancestry, kind, and SQL template, ignoring generated IDs and ordering. It rejects incomplete runs, invalid parent trees, differing datasets/environments/instrumentation, and incompatible sample counts. Journey comparisons use one observation each and do not claim content equality from product counts. Missing browser observations are explicitly warned about.

Comparisons are recomputed from session-owned saved evidence through `POST /api/comparisons`; there is no separate persisted comparison table. After reload, select the saved captures again. No external ingestion or automatic repair is added.

A connected browser → HTTP API → backend → SQL request view for the bundled full-stack cart application. Query-count runs remain a supporting demonstration.

## Connected request demonstration

Choose a scenario and click **Load cart & trace**:

- **Working cart:** the browser receives 20 products, HTTP 200, and two successful query spans.
- **Hidden database failure:** a real read-only division-by-zero query fails with SQLSTATE 22012. The backend catches it and returns an empty cart with HTTP 200. The unified view exposes the mismatch.
- **Correct error handling:** the same database failure produces HTTP 503 and an explicit error. This corrects reporting; it does not repair the failing operation.

The actual browser fetch sends a W3C-format `traceparent`. The server uses that remote parent context for its OpenTelemetry API span, with backend and database spans below it. After reading the response, the browser records its measured duration and observed HTTP status. Backend evidence is persisted before response delivery; browser evidence is attached separately. If browser recording fails, the view explicitly marks that observation missing. Network failures without a completed response cannot be reconstructed from backend evidence alone.

Evidence includes a shared trace ID, parent/span IDs, measured durations, response status, safe query templates, and SQLSTATE. Browser observations are client-reported measurements, not server-certified spans. Request history survives refresh and is restricted to the six-hour guest session. The normal reference cart and older query-count demo are separate requests, collapsed below the main view.

This integration covers our bundled instrumented app. It does not automatically attach to arbitrary websites, collect browser console logs, or diagnose every failure. SQLSTATE is saved without raw database errors or bind values. Public deployment remains unverified.

## What works

- Browser cart with 20 seeded products and five sellers.
- Baseline cart loader: one product query and one batched seller query.
- Shared response validation, loading state, retry, and database error messages.
- PostgreSQL migration and Docker Compose configuration.
- Liveness/readiness routes and graceful server shutdown.
- A persistent embedded PostgreSQL preview for machines without Docker.
- Real manual OpenTelemetry capture: root, business operation, and database spans.
- Baseline, regressed, and prepared fixed runs, with three measured executions each.
- Saved history, SQL template evidence, query counts, timings, and output SHA-256 digests.
- Anonymous six-hour sessions, ownership checks, idempotent requests, and bounded single-run execution.
- Interrupted-run recovery on startup and visible application errors separate from evidence completeness.

Comparison analysis and public deployment remain future phases. This remains a local development build; public hosting and production hardening are not complete.

## Quick local preview (no Docker needed)

Requires Node 24 and pnpm 11.19.0. From this directory:

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm preview:local
```

Open http://127.0.0.1:3001. This preview executes real SQL through PGlite (PostgreSQL compiled to WebAssembly), with data persisted in `.local/postgres`. It is not a separate PostgreSQL 17 server and does not verify the `pg` network driver. Stop it with Ctrl+C before starting another API on port 3001. Rebuild and reload the page after changing frontend code in this mode.

## Standard PostgreSQL development

Requires Docker Desktop or an existing PostgreSQL 17 database.

```powershell
Copy-Item .env.example .env
docker compose up -d --wait
pnpm db:setup
pnpm dev
```

Open http://127.0.0.1:5173. Vite forwards `/api` calls to Express on port 3001. If using an existing database, edit `DATABASE_URL` in `.env` before running `db:setup`; use a dedicated demo database. The migration adds `app` and `demo` schemas. Local Compose credentials are for development only.

## Check the build

```powershell
pnpm build
pnpm test
```

Tests execute SQL in PGlite, validate 2/21/2 query captures and equal output digests, check parent IDs and span limits, exercise session isolation and idempotency, reopen the database to verify persistence, and check restart recovery and safe failure messages. Build before running tests so the static frontend is available.

## Layout

- `apps/web`: React interface and Vite configuration.
- `apps/api`: Express API, cart loader, PostgreSQL migration, local preview.
- `packages/contracts`: shared TypeScript types and Zod response schema.
- `tests`: SQL and HTTP integration checks.

One root dependency manifest and lockfile keep Phase 1 setup small. Source boundaries follow the blueprint; independently published workspace packages are not needed yet. pnpm replaces npm for this build because it is available on the development machine.

## Current checks

- TypeScript and production frontend build: passed.
- SQL/API/trace integration tests: passed.
- Browser baseline → regressed → fixed flow: verified; 2/21/2 queries per execution, each with three samples and identical output.
- Browser reload: saved history and trace evidence remain available.
- Separate PostgreSQL server / Docker connection: not tested on this machine; neither is installed.
- Public hosting: not configured.

## Capture workflow

1. Open the local preview and click **Run baseline**.
2. Click **Run regressed**. Each execution records 21 query spans: one product lookup plus 20 seller lookups.
3. Click **Run fixed**. Each execution returns to two queries; the output digest stays identical.
4. Select any saved run and execution. Expand **Inspect span** for IDs, parents, and allowlisted SQL templates.
5. Reload the page. The session cookie retains access to saved runs for six hours.

Timings are measured locally and depend on the database/runtime. The fixed implementation is prewritten; this tool does not repair source code automatically. Query counts include failed attempted queries, whose span status is shown as an error. `complete` means evidence capture completed; check `appOutcome` separately.

Persistence uses a bounded JSONB trace array on each run, committed with its terminal state in one atomic UPDATE. This is a deliberate simplification of the blueprint's separate traces/spans tables. It avoids partial evidence and is sufficient for the bounded demo; normalized trace tables can be added when needed. SDK providers are scoped to each execution with explicit parent context; no global auto-instrumentation is enabled. Only predefined SQL templates are recorded, never bind values, session tokens, or raw exceptions.

Limits: one active run, three samples, 100 spans per sample, a 15-second cooperative run deadline, 30 runs per session, six runs per minute per session, and 60 runs per rolling hour globally. The server PostgreSQL adapter also has one-second SQL and two-second connection acquisition timeouts. The embedded preview cannot forcibly interrupt a stuck WASM query, so its deadline is checked between operations. Run one server instance per database. Read limits, periodic cleanup, and deployment configuration are implemented; see DEPLOYMENT.md for remaining release checks.

## Next checkpoint

The next release gate is PostgreSQL server validation, Docker image verification, and public HTTPS deployment. The locally verified comparison engine and unified debugging screen are complete for the bundled demo scope.
