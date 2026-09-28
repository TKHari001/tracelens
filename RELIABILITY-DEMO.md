> Historical demonstration notes: the current frontend mounts XRayVision. The older journey, run, comparison, and Reliability Lab screens are retained components but are not mounted. See [README.md](README.md) and [current verification](docs/VERIFICATION.md) before following these notes.

# TraceLens Reliability Lab

This extends X-Ray Vision for Running Applications in the existing project.
The original request tracing and comparison remain available.

## Run and demonstrate

Run `pnpm build`, then `pnpm preview:local`. Open http://127.0.0.1:3001/ and scroll to Reliability Lab.

1. Worker failure: SEV-3; allowlisted restart clears the injected worker fault automatically. Five successful probe windows over at least ten seconds are required before Recovery verified appears.
2. Payment failure: SEV-1 with gateway/orders/payment affected. It waits for Approve demo recovery. The demo rollback clears the injected payment-version fault; measured probes verify the result.
3. Database cascade: one root incident for database plus three dependent failures. Approve the connection-restoration runbook; watch all four recover.
4. Failure drill: reset, select Make next recovery fail, inject a worker failure. Verification must fail, restore the previous demo configuration, and escalate. It must never display recovered.
5. Kill switch: reset, turn off Allow demo runbooks, inject a worker failure. No attempt may execute. Re-enable to permit the normal policy evaluation.

## What is real and what is simulated

- Real: server-side policy, session isolation, actual function probes and timing, SQL health queries, dependency error propagation, approval checks, attempt limit, recovery verification and timeline.
- Simulated: failures and runbook actions affect in-process demo modules. These are not separately deployed microservices, container restarts, payment transactions or production rollbacks.
- Monitoring samples every two seconds while a client has connected within the last minute. Five probes per module form each sample. Latency is measured but is not an SLO recovery gate; verification checks all probes succeed.
- Severity uses the supplied weighted formula, configured demo impact/criticality values, measured failures, graph size and a core-checkout override. CPU, security and memory are not measured and contribute zero.
- A step fault immediately fails all probes. The UI says impact is already present; it does not fabricate a countdown or calibrated repair confidence. A trend estimator exists for increasing error samples, but these scenarios do not establish a useful forecast.
- Incident history is bounded to 20 entries per session in memory and disappears after server restart or session inactivity cleanup. It is not durable incident learning.
- The original cart tracing and the Reliability Lab are separate controlled workloads. Lab repairs do not fix the cart's deliberately injected SQL-error scenario.

## Optional local AI

The default is explicitly labelled rule-based analysis. To enable AI, run an installed Ollama model locally and set `OLLAMA_MODEL` to its name before starting the preview. Optionally set `OLLAMA_URL` (default http://127.0.0.1:11434). The preview reads process environment variables.

Ask local AI sends only synthetic incident evidence to the local model. Its JSON is validated; evidence must match recorded strings and its runbook must match the allowlist. A 20-second timeout or invalid output retains rule-based analysis. AI cannot change severity, policy, or execute a command. Model confidence is self-reported and uncalibrated.

API reference used: https://docs.ollama.com/api/chat

## Review wording

“TraceLens follows a request through the application and exposes hidden failures. Our Reliability Lab extends that idea: it detects controlled failures, identifies affected dependencies, applies a safe recovery policy, and checks whether the repair worked. Isolated worker failures recover automatically. Critical failures require approval. Failed recovery stops and escalates.”

Do not claim arbitrary production repair, trained failure prediction, calibrated confidence, or live AI unless a local model is actually configured and verified.
