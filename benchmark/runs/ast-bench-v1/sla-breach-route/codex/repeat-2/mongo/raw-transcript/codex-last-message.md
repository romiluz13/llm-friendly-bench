Implemented the SLA breach route in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/sla-breach-route/codex/repeat-2/mongo/workspace/src/workflow.mjs#L6). It now:

- derives the escalation from the request, account, and activity documents
- persists workflow state, owner tasks, a customer-safe message, and a customer-visible audit event
- keeps the native document-shaped model in the existing arrays
- returns the portal view with the accepted customer-facing status

`npm test` passes.