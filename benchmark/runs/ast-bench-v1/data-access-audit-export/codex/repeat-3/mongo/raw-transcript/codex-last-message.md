Implemented the benchmark workflow in [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/data-access-audit-export/codex/repeat-3/mongo/workspace/src/workflow.mjs#L1).

What it does:
- Loads the request, account, activities, owner groups, and risk signals.
- Persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`.
- Computes a hashable audit trail and a customer-safe summary.
- Returns the portal view with the expected customer-facing status.

Validation:
- `npm test` passes.