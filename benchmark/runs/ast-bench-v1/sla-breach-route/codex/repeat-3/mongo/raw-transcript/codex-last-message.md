Implemented the SLA breach route in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/sla-breach-route/codex/repeat-3/mongo/workspace/src/workflow.mjs#L37). It now:

- Resolves the account context and open activities.
- Builds persisted risk signals, owner tasks, workflow state, customer-safe message, and customer-visible audit event.
- Keeps the MongoDB lane document-shaped and native.
- Produces the required customer-facing status and timer audit state.

Validation:
- `npm test` passed.
- `npm run render` passed.

