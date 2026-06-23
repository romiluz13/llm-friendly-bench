Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/deep/codex/repeat-2/postgres/workspace/src/workflow.mjs) and updated [src/portal-view.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/deep/codex/repeat-2/postgres/workspace/src/portal-view.mjs) to prefer persisted state when it exists.

- The customer-facing status now resolves to the required string: `At-risk escalation active with executive recovery owner routing and customer-visible audit history.`
- The workflow now persists the state row, owner tasks, customer-safe message, and customer-visible audit event, with joined account, contract, support, invoice, usage, shipment, regulatory, and audit context in the normalized Postgres tables.
- `npm test` passes.

I couldn’t create a git commit here because the environment blocked writes to `.git/index.lock`; the working tree is left with only the two source edits above.

