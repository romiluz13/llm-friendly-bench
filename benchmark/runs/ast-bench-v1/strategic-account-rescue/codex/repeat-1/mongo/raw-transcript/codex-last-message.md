Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/strategic-account-rescue/codex/repeat-1/mongo/workspace/src/workflow.mjs#L16).

- The persisted workflow state now combines account, contract, support, invoice, usage, shipment, regulatory, audit, and routing context, while keeping the exact acceptance status string in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/strategic-account-rescue/codex/repeat-1/mongo/workspace/src/workflow.mjs#L31).
- It upserts `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` by `requestId`, so reruns stay idempotent and the portal projection stays aligned in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/strategic-account-rescue/codex/repeat-1/mongo/workspace/src/workflow.mjs#L103) and [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/strategic-account-rescue/codex/repeat-1/mongo/workspace/src/workflow.mjs#L142).
- `npm test` passes.
- I couldn’t create a git commit because this environment blocks writes under `.git` (`Operation not permitted` on `.git/index.lock`).

