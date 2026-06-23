Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/split-shipment-exception/codex/repeat-1/mongo/workspace/src/workflow.mjs:5): `applyBenchmarkTask` now upserts the workflow state, one owner task per owner group, a customer-safe message, and a customer-visible audit event from the native document collections. The state also carries the risk signals, account tier, replacement plan, and audit timeline so the portal projection can render the required split-shipment exception status.

Validation: `npm test` passes.

I couldn’t create a git commit here because the sandbox blocked `.git/index.lock` creation with `Operation not permitted`.
