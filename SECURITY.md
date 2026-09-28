# Security and operating boundaries

TraceLens is a local, trusted-user exhibition prototype. No supported production release is declared.

## Current implementation limits

- `/api/v1` and `/api/telemetry` are mounted before the session/origin checks in the trace router. They do not inherit the six-hour trace-session access controls.
- Package analysis accepts paths on the API server's disk without a project-directory allowlist. The apply-fix endpoint can overwrite an existing supplied path when `writeToDisk` is true. Keep the server on loopback and use disposable or version-controlled copies.
- SSE broadcasts share one in-process client set, including analysis output. They are not isolated per user or project.
- Cloud package analysis can send source contents and file paths to the selected AI provider. Inspect inputs and provider configuration before analyzing private material. Some API failures return static fallback results rather than a hard failure.
- SQL evidence from the bundled trace demo is allowlisted and omits bind values, but that guarantee does not cover arbitrary package-analysis output, general telemetry, or exception messages from other endpoints.
- Suggested patches use predefined text replacements, not a verified general-purpose repair engine. Reanalysis is not a substitute for executing the affected project's tests.

Before network/public use, add authentication and authorization across every router, constrain readable/writable paths, isolate SSE subscriptions, protect provider keys, validate requests, and test the resulting boundaries. Historical deployment files do not establish that these controls exist.

## Secrets and reports

Keep API keys and database credentials in local environment variables or an appropriate deployment secret store. `.env` and local data are excluded from Git; `.env.example` contains only demonstration values and commented placeholders.

Do not post credentials, private source, or exploit details in public issues. Use GitHub private vulnerability reporting if the repository owner has enabled it, or arrange a private reporting channel with the owner. No dedicated security contact or response-time commitment has been configured.
