Implemented the split-shipment exception workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/split-shipment-exception/codex/repeat-3/postgres/workspace/src/workflow.mjs).

What it now does:
- Reconstructs the request context from the normalized tables.
- Persists one workflow state row with the expected status, next step, routing, and reconciliation fields.
- Persists one owner task per owner group, a customer-safe message, and a customer-visible audit event.
- Keeps the data model scalar and idempotent so reruns do not duplicate rows.

Validation:
- `npm test` passed.
- `npm run render` also succeeded and wrote proof output under `artifacts/`.