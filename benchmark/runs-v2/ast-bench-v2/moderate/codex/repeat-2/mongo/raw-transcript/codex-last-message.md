Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/moderate/codex/repeat-2/mongo/workspace/src/workflow.mjs#L5). The workflow now:
- loads the strategic account request and account context,
- persists idempotent `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` documents,
- carries account, contract, support, invoice, usage, shipment, regulatory, and audit context in native document shape,
- returns the portal projection with the required customer-facing status.

`npm test` passes.

