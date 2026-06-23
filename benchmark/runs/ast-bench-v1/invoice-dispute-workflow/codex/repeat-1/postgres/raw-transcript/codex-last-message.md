Implemented [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/invoice-dispute-workflow/codex/repeat-1/postgres/workspace/src/workflow.mjs) so the invoice-dispute workflow now reads the normalized owner groups, risk signals, and activities, then persists workflow state, owner tasks, the customer-safe message, and the customer-visible audit event before returning the portal view.

`npm test` passes.

I could not create a git commit here because writes under `.git` are blocked in this sandbox. The failure was `Operation not permitted` when creating `.git/index.lock`.

