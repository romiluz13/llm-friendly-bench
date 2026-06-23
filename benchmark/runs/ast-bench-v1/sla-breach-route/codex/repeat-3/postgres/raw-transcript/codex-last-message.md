Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/sla-breach-route/codex/repeat-3/postgres/workspace/src/workflow.mjs).

- Replaced the stub with a deterministic SLA-breach route that reads the normalized request, account, contract, contacts, owner groups, risk signals, and activity rows.
- Persisted the workflow state, four owner tasks, a customer-safe customer message, and a customer-visible audit event, while keeping the internal owner step and timer audit separate.
- `npm test` passes.

