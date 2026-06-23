Implemented the Mongo workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/moderate/codex/repeat-4/mongo/workspace/src/workflow.mjs#L21), leaving tests and fixture data untouched.

It now:
- reconstructs the request from account and activity documents
- persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`
- records the full audit timeline plus customer-safe routing context
- returns the portal projection with the exact required customer-facing status

`npm test` passes.
