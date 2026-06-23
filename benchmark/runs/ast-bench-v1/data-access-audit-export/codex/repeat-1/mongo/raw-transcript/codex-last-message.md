Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/data-access-audit-export/codex/repeat-1/mongo/workspace/src/workflow.mjs#L6). It now:
- reconstructs the account/activity context
- persists workflow state, owner tasks, a customer-safe message, and a customer-visible audit event
- records a SHA-256 audit trail hash plus scoped-record metadata
- returns the portal projection with the expected ready status

`npm test` passes.

I couldn’t create the git commit here because the sandbox blocks creating `.git/index.lock`.
