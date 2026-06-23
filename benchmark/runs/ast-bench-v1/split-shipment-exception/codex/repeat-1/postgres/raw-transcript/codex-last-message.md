- Implemented the workflow in [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/split-shipment-exception/codex/repeat-1/postgres/workspace/src/workflow.mjs#L3). It now reads the request, ordered owner groups, risk signals, account, and contract; persists workflow state, owner tasks, the customer message, and a customer-visible audit event; then returns the portal projection.
- `npm test` passes.
- I couldn’t create a git commit from this sandbox because writing `.git/index.lock` is blocked here.

