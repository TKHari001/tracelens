> Historical demonstration notes: the current frontend mounts XRayVision. The older journey, run, comparison, and Reliability Lab screens are retained components but are not mounted. See [README.md](README.md) and [current verification](docs/VERIFICATION.md) before following these notes.

# Two-minute presentation

Before presenting: `pnpm build`, `pnpm test`, then `pnpm preview:local`. Open http://127.0.0.1:3001. In another terminal, `pnpm rehearse` verifies three HTTP rounds and refreshes the backup. These rehearsals are CLI requests; no browser timings are fabricated.

1. **Problem:** “Developers jump between browser tools, backend logs, and database tools. We connect the evidence for one request.”
2. **Working cart:** Load it and show 20 products, HTTP 200, and two successful database queries sharing one trace ID.
3. **Hidden failure:** Load it and show zero products with HTTP 200, despite the failed backend/database operation. Expand the SQL evidence and SQLSTATE 22012.
4. **Correct error handling:** Load it and show HTTP 503 matching the failure. Explain that error reporting is corrected; the database operation still fails.
5. **Persistence:** Reload and select an earlier request.
6. **Compare:** In What changed?, select Connected requests, refresh choices, and compare the new healthy and hidden-failure requests. Show unchanged HTTP 200 alongside products 20 → 0 and the failed database evidence.
7. **Scope:** “This prototype instruments our bundled app. External application integration is next.”

Optional: capture baseline/regressed/fixed in the query-count panel. Select Three-sample query runs in What changed?, refresh choices, and compare baseline to regressed. Expand db.sellerOne to inspect repeated SQL and its span IDs. Select fixed as After to verify 2 → 2 and matching output. Budget an extra minute for this supporting demo.

## Backup plan

- Keep `demo/recorded-demo.html` locally. It opens without a server or network connection.
- If live execution fails, say **“This is recorded evidence from earlier real requests, not a live execution.”**
- If hosting fails, use the embedded PostgreSQL local preview and identify it as the local runtime.
- If a request limit is reached, pause and retry. Do not disable limits during the presentation.
- No video recording is included. Do not claim automatic source repair, arbitrary-application support, or guaranteed root-cause detection.
