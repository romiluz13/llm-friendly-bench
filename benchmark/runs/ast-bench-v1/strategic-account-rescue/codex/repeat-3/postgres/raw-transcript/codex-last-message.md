Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/strategic-account-rescue/codex/repeat-3/postgres/workspace/src/workflow.mjs). It now reconstructs the request/account/contract context, persists the workflow state, owner tasks, customer-safe message, and customer-visible audit event, then returns the portal view.

`npm test` passes.