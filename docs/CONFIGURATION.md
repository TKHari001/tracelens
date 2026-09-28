# Configuration and troubleshooting

Use Node 24.x and pnpm 11.19.0. The API, preview, and migration package scripts load `.env` when present through Node's `--env-file-if-exists` option. Real process environment variables take precedence. The rehearsal script reads `DEMO_URL` from the process environment.

## Environment variables

| Variable | Default / purpose |
| --- | --- |
| `DATABASE_URL` | Required by the normal server and migration script; PostgreSQL URL for the network pool. Not needed for the embedded cart/trace preview. |
| `PORT` | API/preview port; defaults to 3001. |
| `HOST` | Normal server binding; defaults to `127.0.0.1`. Embedded preview always binds to loopback. |
| `NODE_ENV` | Set to `production` only for a configured deployment. Enables secure session cookies and production origin validation. |
| `APP_ORIGIN` | Required by the normal production server; HTTPS origin without a trailing slash. |
| `ANTHROPIC_API_KEY` | Optional Claude package-analysis credential. |
| `OPENAI_API_KEY` | Optional OpenAI package-analysis/chat credential. |
| `GEMINI_API_KEY` | Optional Gemini package-analysis/chat credential. |
| `GOOGLE_AI_API_KEY` | Alternate Gemini credential; `GEMINI_API_KEY` takes precedence. |
| `OLLAMA_MODEL` | Optional model for hypotheses in the retained Reliability Lab. |
| `OLLAMA_URL` | Local Ollama endpoint; defaults to `http://127.0.0.1:11434`. |
| `DEMO_URL` | Rehearsal target; defaults to `http://127.0.0.1:3001`. |

Copy `.env.example` only when `.env` does not exist. Keep keys out of commits. Cloud analysis transmits submitted source files to the selected provider and can incur provider charges; static analysis needs no key.

The current source does **not** read `TRUST_PROXY_HOPS`; older release notes mention it, but setting it will not configure Express proxy trust.

## Provider behavior

Choose a provider supported by the current adapters: `Anthropic Claude`, `OpenAI ChatGPT`, or `Google Gemini`. An unknown provider name falls back to Claude. The package analyzer defaults to Claude; it does not automatically switch to another configured provider in every path.

Adapters contain fixed model identifiers and timeouts. Provider/model availability must be checked separately before demonstrations. Missing keys, non-success responses, timeouts, or malformed output can produce static fallback results. Claude chat is currently a canned demonstration; do not present it as live model output.

## Common problems

| Symptom | Check |
| --- | --- |
| Missing or stale frontend | Run `pnpm build` before preview/start; rebuild after UI edits. |
| Port 3001 already in use | Stop the prior preview/API process before starting another. |
| API unavailable from Vite | Start `pnpm dev:api`; the checked-in proxy targets port 3001. |
| Missing `DATABASE_URL` | Use the PGlite preview or configure a dedicated PostgreSQL database and run migrations. |
| Empty telemetry/application lists in preview | Those routes use the separate network PostgreSQL pool; PGlite alone does not supply them. |
| Source path rejected | The path must exist and be readable on the API server, not only on a remote browser's machine. |
| Analyzer says `PASSED` but finds bugs | This denotes successful analyzer execution, not successful target-project tests. |
| AI returns no extra findings | Inspect the response/model status and credentials; a fallback is not proof of a successful provider call. |
| Historical cart/lab screens missing | They are retained components, not mounted by the current `XRayVision` entry point. |
| Trace session expired or limited | Start a new session after expiry or wait for the limit window; do not remove guards for a presentation. |

Stop all preview processes before backing up or resetting `.local/postgres`. Resetting that directory loses saved evidence, so make an intentional backup first. Keep the server local until the boundaries in [SECURITY.md](../SECURITY.md) are addressed.
