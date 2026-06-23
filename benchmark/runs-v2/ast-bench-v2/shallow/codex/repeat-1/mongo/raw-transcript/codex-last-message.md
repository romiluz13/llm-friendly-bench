Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-1/mongo/workspace/src/workflow.mjs#L3).

- `applyBenchmarkTask` now reads the request, account, and activity documents, writes `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`, and returns the portal projection.
- The persisted state now carries the expected status plus combined account context for tier, contract, support, invoice, usage, shipment, regulatory, and audit history. The helper work is in the same file at [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-1/mongo/workspace/src/workflow.mjs#L84).
- I kept owner routing derived from the existing fixture `ownerGroups` so the benchmark contract stays aligned with the test data.

`npm test` passes.

