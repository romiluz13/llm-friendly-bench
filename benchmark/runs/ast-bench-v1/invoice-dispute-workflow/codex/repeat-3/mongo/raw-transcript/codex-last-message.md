Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/invoice-dispute-workflow/codex/repeat-3/mongo/workspace/src/workflow.mjs#L3). It now reads the native request/account/activity documents, upserts the workflow state, creates one open owner task per owner group, writes a customer-safe message, and records a customer-visible audit event. The nested evidence bundle is assembled around [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/invoice-dispute-workflow/codex/repeat-3/mongo/workspace/src/workflow.mjs#L87).

`npm test` passes.

I attempted to commit, but the environment blocked `.git/index.lock` creation, so the change is left in the worktree.

