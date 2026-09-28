# TraceLens

**X-Ray Vision for source code, application traces, and controlled reliability experiments.**

TraceLens is a local exhibition prototype for investigating software issues. Its React dashboard combines package analysis, issue triage, remediation previews, AI-provider adapters, and live server-sent events. The repository also includes an instrumented cart application, saved trace comparisons, and a controlled Reliability Lab.

Built with **TypeScript · React 19 · Vite · Express 5 · PostgreSQL / PGlite · OpenTelemetry**.

## What you can explore

| Capability | Current implementation |
| --- | --- |
| Package analysis | Analyze supplied source files or a path on the server's disk; inspect findings, file discovery, analysis stages, and a heuristic health score. |
| Language analyzers | Pattern-based Python and JavaScript/TypeScript checks, plus a generic analyzer. These are not full compiler parsers or a security audit. |
| Issue dashboard | Browse active and critical issues, recommendations, analysis output, and remediation history. |
| Optional AI | Package-analysis adapters for Anthropic Claude, OpenAI, and Google Gemini; provider-specific chat support. Missing keys and API failures can fall back to static results. |
| Remediation prototype | Preview predefined text replacements and optionally write a selected file on the server. Review changes and run real tests before relying on a fix. |
| Request evidence | Bundled cart scenarios expose successful requests, hidden SQL failures behind HTTP 200, and explicit HTTP 503 errors. |
| Comparisons and reliability | Compare saved request/run evidence and exercise controlled failure/recovery policies through the retained API and components. |

**Current UI:** `apps/web/src/main.tsx` mounts `XRayVision`. The older journey, run, comparison, and Reliability Lab components remain in the source but are not mounted in this entry point. Historical guides describe those earlier screens; they are not instructions for the current dashboard.

**Run locally on a trusted machine.** Package-analysis and file-write endpoints are not protected by the guest-session controls used for trace captures. Public hosting needs further hardening; see [security and operating boundaries](SECURITY.md).

## Quick start: no Docker required

Requirements: **Node.js 24.x** and **pnpm 11.19.0** (matching `package.json`). Run all commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm preview:local
```

Open **http://127.0.0.1:3001**. The preview runs migrations automatically and stores embedded PostgreSQL data under `.local/postgres`. No API key is required for static analysis. Stop with **Ctrl+C**.

Use `tests/fixtures/sample_clean.py` and `tests/fixtures/sample_bug.py` as small analysis examples. Paths entered in the dashboard refer to files on the machine running the API. Rebuild and refresh after frontend edits in preview mode.

PGlite executes PostgreSQL in WebAssembly; it does not validate a network PostgreSQL connection. Some telemetry and dashboard-list routes use the separate `pg` pool and need `DATABASE_URL` plus a PostgreSQL server even when the preview is running.

## Develop with PostgreSQL

Use Docker with Compose or a dedicated PostgreSQL 17 database. After installing dependencies:

```powershell
# Create .env only if it does not already exist.
Copy-Item .env.example .env
docker compose up -d --wait
pnpm db:setup
pnpm dev
```

On macOS/Linux, use `cp .env.example .env` for the copy step. For an existing database, update `DATABASE_URL` before migrations and skip Docker Compose. The bundled database credentials are for local demonstrations only.

Open **http://127.0.0.1:5173**. Vite forwards `/api` requests to Express on port 3001. Stop any preview already using port 3001 first.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start API watch mode and Vite together. |
| `pnpm dev:api` / `pnpm dev:web` | Start each development process separately. |
| `pnpm preview:local` | Serve the built UI with a persistent PGlite database. |
| `pnpm db:setup` | Apply migrations to the configured PostgreSQL server. |
| `pnpm typecheck` | Check TypeScript without emitting files. |
| `pnpm build` | Type-check and build the frontend. |
| `pnpm test` | Run the local test suite, including embedded SQL and HTTP tests. |
| `pnpm test:postgres` | Run the separate network PostgreSQL integration check. |
| `pnpm start` | Start the API against `DATABASE_URL`, serving built frontend files if present. |
| `pnpm rehearse` | Exercise cart request scenarios and regenerate recorded demo evidence. |

Build before running tests. On **2026-09-28**, Node 24.19.0 and pnpm 11.19.0 completed the production build and **21/21 test-runner entries passed**, including the Python analyzer's four internal regression cases. This does not verify live AI providers, Docker, or public deployment. See [verification details](docs/VERIFICATION.md).

## Repository map

```text
apps/
  api/src/              Express routes, analysis, telemetry, traces, and recovery policies
  api/migrations/       SQL schemas and demonstration data
  web/src/              Current X-Ray dashboard and retained demo components
packages/
  contracts/src/        Shared types and validation
  engine/src/           Evidence comparison engine
tests/                  Unit and integration tests; source-analysis fixtures
demo/                   Previously recorded local request evidence and HTML playback
scripts/                HTTP demonstration rehearsal
docs/                   Architecture, configuration, API, and verification notes
.github/workflows/      Existing build/test workflow with PostgreSQL 17
```

The project uses one root dependency manifest and a committed pnpm lockfile. Dependencies, build output, local databases, and private environment files are excluded from Git.

## Documentation

- [Architecture and data flow](docs/ARCHITECTURE.md)
- [Configuration and troubleshooting](docs/CONFIGURATION.md)
- [API overview](docs/API.md)
- [Verification and remaining checks](docs/VERIFICATION.md)
- [Contributing](CONTRIBUTING.md)
- [Security and operating boundaries](SECURITY.md)
- [X-Ray dashboard guide](README-XRAY.md)
- [Deployment preparation](DEPLOYMENT.md)
- Historical demonstrations: [request tracing](docs/TRACE-DEMO.md), [presentation script](DEMO.md), [Reliability Lab](RELIABILITY-DEMO.md), and [phase notes](PHASES.md).

## Scope and licensing

This is an exhibition prototype, not a production monitoring or autonomous repair service. Analyzer stages marked `PASSED` mean the analyzer ran, not that the inspected code passed its own test suite. Health scores and confidence values are heuristic; SSE analysis timings include illustrative constants. Provider labels alone do not establish that a live model answered.

No project license has been selected. No `LICENSE` file is added in this publication; contact the repository owner before reusing or redistributing the project. Dependencies retain their respective licenses.
