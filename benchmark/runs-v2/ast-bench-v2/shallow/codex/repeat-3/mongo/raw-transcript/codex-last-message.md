Implemented the Mongo workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-3/mongo/workspace/src/workflow.mjs#L1). It now persists the workflow state, owner tasks, customer-safe message, and audit events, and reconstructs the account/contract/support/invoice/usage/shipment/regulatory/audit context from the existing document-shaped collections. No tests or fixture data were changed.

`npm test` passes.

