Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/invoice-dispute-workflow/codex/repeat-3/postgres/workspace/src/workflow.mjs#L5). The workflow now reads the ordered owner groups and risk signals from the normalized tables, persists workflow state, owner tasks, a customer-safe message, and a customer-visible audit event, and returns the portal projection with the expected status.

`npm test` passes.

