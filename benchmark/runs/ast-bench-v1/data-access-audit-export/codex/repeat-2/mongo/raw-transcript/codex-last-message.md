Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/data-access-audit-export/codex/repeat-2/mongo/workspace/src/workflow.mjs#L6). It now reconstructs the account/activity context, computes a hashable audit trail, and persists the workflow state, owner tasks, customer-safe message, and customer-visible audit event in the native MongoDB document shape.

`npm test` passes.

