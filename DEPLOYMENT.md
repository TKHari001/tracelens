> Historical release preparation, not a production-readiness claim. The current package-analysis/file-write and telemetry routes lack the trace router's session guards. Keep this version local until the boundaries in [SECURITY.md](SECURITY.md) are addressed. Current checks are in [docs/VERIFICATION.md](docs/VERIFICATION.md).

# Railway release

Release files are prepared. No public deployment has been created or verified.

## Verified locally

- Production frontend build and 13 automated tests pass, including Phase 4 comparisons.
- Three HTTP rehearsals pass all three scenarios (nine requests).
- Browser hidden-failure flow works with the content security policy.
- `demo/recorded-demo.html` and `demo/recorded-evidence.json` contain real recorded local evidence.
- Production dependency audit reports no known vulnerabilities at preparation time.

## Not yet verified

Docker image build, PostgreSQL 17 server integration, GitHub Actions execution, and public HTTPS checks. Docker and server PostgreSQL are absent here; no Railway project is connected. Phase 4 comparison is implemented and browser-verified locally. The recorded backup predates the comparison UI and covers the request journey demonstration.

## Deploy

1. Use this `tracelens` directory as the repository/deployment root. Do not upload `.env`, `.local`, or `node_modules`.
2. In an authorized Railway project, add a dedicated PostgreSQL 17 service and application service in the same region. Review charges before purchasing a plan or adding paid resources.
3. Set the application's `DATABASE_URL` from the database's private connection URL using Railway's variable reference UI. Keep credentials out of source files and chat.
4. Set `APP_ORIGIN=https://YOUR-PUBLIC-HOST`, without a trailing slash. The Docker image supplies `NODE_ENV=production` and `HOST=0.0.0.0`; Railway supplies `PORT`.
5. Review proxy trust in code before deploying. The current application does not read `TRUST_PROXY_HOPS`; setting that variable alone has no effect. Configure and test trusted proxies as a separate hardening change.
6. Configure exactly **one app replica in one region**. Limits and background execution are in-process.
7. Deploy. The supplied `railway.json` runs migrations before startup and checks `/api/health/ready`. The Docker runtime runs as the non-root `node` user.
8. Test the public HTTPS URL in a browser: healthy cart, hidden failure, honest error, saved history after refresh, and isolation in a second browser session.
9. Set `DEMO_URL` to that HTTPS origin and run `pnpm rehearse` from a local terminal. This creates nine synthetic requests across three sessions and refreshes the recorded backup.

Configuration references: [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [config reference](https://docs.railway.com/config-as-code/reference), [pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command).

## PostgreSQL and image checks

On a machine with Docker, from this directory:

```powershell
Copy-Item .env.example .env
docker compose up -d --wait
pnpm db:setup
pnpm test:postgres
docker build -t tracelens:release .
```

Use only a dedicated demo database. Then stop the embedded preview on port 3001, run `pnpm start`, and run `pnpm rehearse`. The GitHub workflow includes PostgreSQL 17 and this adapter test, but it has not yet run remotely.

## Restart and rollback

Do not overlap old and new application processes against the same database. Startup marks unfinished runs interrupted, so overlapping processes could mark each other's work. Deploy while idle, stop the old process first, and accept brief downtime for this hackathon version. Zero-downtime rolling deployment is not supported.

Keep the previous working source revision and lockfile. If a release fails, return to them. Current migrations are additive; do not drop evidence tables as a rollback. Do not bypass failing readiness checks.

## Limits

- The trace router applies 120 authenticated requests/minute/session. The current app does not mount a global 300 requests/minute/IP limiter, and earlier-mounted v1/telemetry routers do not inherit the trace limits.
- 10 new sessions/hour/IP; six-hour sessions. Cleanup runs every minute with a one-minute expiry grace period and retains active background runs.
- Each demo family has six captures/minute/session, 30/session, and 60/hour globally. Request journeys and query-count runs have separate counters.
- One background run and one request journey at a time; they may run concurrently with each other.
- PostgreSQL server queries have a one-second statement timeout and two-second connection acquisition timeout.
- Browser observations remain client-reported. Raw database errors, bind values, and credentials are not stored as evidence.

Dependency auditing is a point-in-time check, not a guarantee against every security issue.
