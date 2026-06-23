Implemented the workflow mutation in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/strategic-account-rescue/codex/repeat-2/mongo/workspace/src/workflow.mjs#L5). It now persists the workflow state, owner tasks, customer-safe message, and a full audit timeline from the activity records, while returning the portal projection with the required customer-facing status.

Validation:
- `npm test` passed.

I couldn’t create a git commit here because this environment blocks creating `.git/index.lock`.

