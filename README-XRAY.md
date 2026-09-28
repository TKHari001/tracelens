# X-Ray dashboard guide

The current entry point mounts `XRayVision`, a React/Vite interface for source analysis and issue review.

## Start locally

Use Node 24.x and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm preview:local
```

Open http://127.0.0.1:3001. The preview initializes its embedded database automatically. `pnpm db:setup` is for a separately configured network PostgreSQL database.

## Explore the dashboard

Analyze a small source file or package path on the server. The included Python fixtures provide clean and deliberately buggy examples. Review the active issues, critical issues, recommendations, and analysis stages. A completed analyzer can report findings; its completion status does not mean that the inspected code is correct.

AI package analysis is optional. Configure a supported provider key in a local `.env` and choose the corresponding provider. Claude package analysis can use a live API, but its chat implementation is currently canned; fallback output must not be presented as verified live AI.

Fix previews use predefined text substitutions. Review the result on a version-controlled copy before enabling a disk write. Reanalysis does not execute the target project's tests.

## Data and limitations

Live server-sent events carry logs and analysis results to the dashboard. Several telemetry/list routes still use a separate network PostgreSQL pool, even in embedded preview mode. These lists can be empty without that database.

The older cart journey, comparison, and Reliability Lab components remain in source but are not mounted in the current interface. Read the [main README](README.md), [configuration guide](docs/CONFIGURATION.md), and [security boundaries](SECURITY.md) for the current scope.
