Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-4/mongo/workspace/src/workflow.mjs#L21). It now:
- persists the workflow state, owner tasks, customer message, and customer-visible audit events into the existing document collections;
- carries the account, contract, support, invoice, usage, shipment, regulatory, and audit context in `workflow_state`;
- returns the acceptance portal status: `At-risk escalation active with executive recovery owner routing and customer-visible audit history.`

`npm test` passes.

