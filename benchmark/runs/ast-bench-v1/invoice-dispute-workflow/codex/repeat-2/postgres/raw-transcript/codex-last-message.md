Implemented the invoice-dispute workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/invoice-dispute-workflow/codex/repeat-2/postgres/workspace/src/workflow.mjs#L5) by reading the normalized owner groups and risk signals, persisting workflow state, owner tasks, the customer message, and the audit event, then returning the portal projection.

`npm test` passes.

I couldn’t create a git commit here because Git is blocked from creating `.git/index.lock` in this checkout.
