> Historical demonstration notes: the current frontend mounts XRayVision. The older journey, run, comparison, and Reliability Lab screens are retained components but are not mounted. See [README.md](README.md) and [current verification](docs/VERIFICATION.md) before following these notes.

# Execution status

| Phase | Status | Exit check |
|---|---|---|
| 1. Foundation | Local preview verified; standard PostgreSQL verification remains | Browser displays real SQL-backed products; build and SQL/API tests pass |
| 2. Runtime capture | Implemented and verified locally | Three implementations, real OTel evidence, saved runs, counts 2/21/2 across three samples; same output; survives reload and database reopen |
| 3. Connected request journey | Implemented and verified locally | Actual browser fetch → API → backend → database; healthy, hidden failure, and honest error cases; owned saved evidence |
| 4. Complete interface and comparison | Implemented and verified locally | Connected-request differences, +19 queries, fixed verification, parent/template matching, evidence drill-down |
| 5. Stabilize and demo | Local release preparation complete; public release pending | 13 tests; prior three HTTP rehearsals and offline backup; Docker/PostgreSQL server/public deployment still unverified |

## Resolved setup issues

- Missing Docker/PostgreSQL: added a clearly documented embedded PostgreSQL local preview; retained the planned PostgreSQL server adapter.
- Dependency installation required network access: installed and locked dependencies.
- esbuild setup script initially blocked by package-manager defaults: explicitly allowlisted esbuild and completed installation.
- Sandbox could not read installed dependency hard links: build and test were successfully run with the required filesystem access.

## Remaining checks

- Run migration and HTTP smoke checks against PostgreSQL 17 before public deployment.
- Phase 4 is locally verified; comparisons are recalculated from saved source captures, not independently persisted.
- Phase 5 remaining: Docker image, PostgreSQL server adapter, and public HTTPS deployment smoke checks.

## Phase 2 verification

- Production frontend build and TypeScript checks pass.
- SQL and SDK tests verify counts, parent linkage, output equality, application-error status, and the span cap.
- HTTP tests verify session isolation, idempotency, input/origin validation, and stored trace retrieval.
- Persistence test closes/reopens an on-disk database; completed evidence survives and unfinished work becomes interrupted.
- Browser test runs all three variants and reloads successfully with saved evidence.

## Revised Phase 3 verification

- Build and all eight integration tests pass, including existing Phase 1/2 checks.
- Real HTTP test verifies browser trace context is the API parent, followed by backend and SQL children.
- Real PostgreSQL SQL raises 22012; hidden mode responds 200/empty cart, honest mode responds 503/error.
- Browser checks verify all three scenarios and saved history after reload.
- Missing browser observations remain explicitly missing rather than inferred from backend timings.
- Phase 3 uses the bundled app; integration with an external application remains outside the current demo scope.

## Phase 5 verification

- Added bounded API/session limits, Retry-After, periodic expiry cleanup, production origin checks, and security headers.
- Removed external font loading; the interface no longer needs a font network request.
- Added a non-root Docker runtime, Railway migration/readiness configuration, and a PostgreSQL-backed CI workflow.
- Local build and all 13 tests pass after Phase 4 integration. Production dependency audit during Phase 5 reported no known vulnerabilities.
- Three automated HTTP rehearsals passed all scenarios. Browser hidden-failure flow passed after hardening.
- Recorded JSON and standalone offline HTML are in `demo/`. No video was recorded.
- No Railway project is connected; Docker and server PostgreSQL are not installed locally. These release checks remain pending.
- See DEPLOYMENT.md and DEMO.md. Phase 4 comparison is now complete locally.

## Phase 4 acceptance checks

- Browser comparison shows 2 → 21 queries, +19, and identical cart digests.
- Repeated seller group exposes 60 saved spans across three executions; absent groups show zero on that side.
- Baseline → fixed shows 2 → 2 and matching structure, errors, and output.
- New healthy → hidden-failure requests show HTTP 200 → 200, products 20 → 0, and a recorded database error.
- Tests cover incomplete captures, missing/cyclic parents, duplicate spans, changed environments, output changes, meaningful timing thresholds, and ownership protection.
- Older journeys without comparison metadata require recapture. Single-request comparisons carry explicit sampling and output-equality limits.
