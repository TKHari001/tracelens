# Verification record

Repository preparation check: **2026-09-28**, Windows, Node **24.19.0**, pnpm **11.19.0**.

| Check | Result |
| --- | --- |
| `pnpm build` | Passed: TypeScript validation and Vite production build. |
| `pnpm test` | Passed: 21 test-runner entries, 0 failures. |
| Python analyzer regression script | Four internal cases passed: clean, broken, empty, and missing file. Included in the test run above. |
| Live cloud AI providers | Not exercised during repository preparation. |
| Separate PostgreSQL 17 adapter test | Not exercised locally during repository preparation. |
| Docker image and public deployment | Not verified during repository preparation. |

The existing suite checks measured 2/21/2 SQL capture, output digests, parent/span integrity, capture limits, saved evidence, session isolation, idempotency, restart recovery, comparison behavior, HTTP guards, fixture analysis, and controlled reliability policies.

The GitHub Actions workflow already includes a PostgreSQL 17 service, frozen dependency installation, build, local tests, migrations, and `pnpm test:postgres`. Check the Actions tab for the actual result after pushing; a local pass does not establish a hosted CI pass.

## Interpretation

- The tests use PGlite for much of the SQL coverage; network-driver behavior is a separate check.
- Analyzer subsystem status is distinct from the correctness of analyzed code.
- Current providers may return static fallbacks, so passing tests does not validate a live provider.
- Trace and Reliability Lab tests exercise retained APIs even though their old UI components are not mounted in the current dashboard.
- Existing recorded demo artifacts document earlier requests, not a new live run.
- Source, fixtures, dependency versions, and application behavior were preserved during documentation preparation.
