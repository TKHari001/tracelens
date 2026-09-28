# Contributing to TraceLens

Read the [README](README.md), [architecture](docs/ARCHITECTURE.md), and [security boundaries](SECURITY.md) before making changes. Keep pull requests focused and explain the observed problem, resulting behavior, and validation performed.

## Local workflow

1. Use Node 24.x and pnpm 11.19.0.
2. Run `pnpm install --frozen-lockfile` and follow either local-preview or PostgreSQL setup in the README.
3. Make changes on a branch. Preserve the distinction between measured request evidence, static findings, AI output, and simulated demonstrations.
4. Run `pnpm build` and `pnpm test`. For database changes, also migrate a dedicated PostgreSQL 17 database and run `pnpm test:postgres`.
5. Update documentation when commands, configuration, endpoints, or visible behavior change.

Do not commit `.env`, API keys, captured private source code, `.local`, dependencies, or generated builds. Use synthetic examples for reports and tests. Commit `pnpm-lock.yaml` when intentionally changing dependencies; avoid adding a second package-manager lockfile.

## Review expectations

- Add meaningful tests for behavior changes, especially session ownership, evidence integrity, database migrations, and file access.
- Treat AI suggestions and heuristic fixes as unverified until reviewed and tested.
- Do not claim provider verification or production support based only on passing local tests.
- Include reproduction steps and expected/actual results in bug reports; redact private paths and credentials.

The repository currently has no project license or contributor agreement. Discuss intended licensing with the owner before contributing third-party material.
