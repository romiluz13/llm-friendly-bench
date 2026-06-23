Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/moderate/codex/repeat-1/mongo/workspace/src/workflow.mjs). It now persists the workflow state, owner tasks, customer-safe message, and customer-visible audit trail, and it reconstructs the account/support/invoice/usage/shipment/regulatory context natively in MongoDB document form. No tests or fixture data were changed.

Validation: `npm test` passed. `npm run render` also completed successfully.

