Implemented in [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/strategic-account-rescue/codex/repeat-2/postgres/workspace/src/workflow.mjs#L5) and [`src/portal-view.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/strategic-account-rescue/codex/repeat-2/postgres/workspace/src/portal-view.mjs#L1).

- `applyBenchmarkTask` now reconstructs the request context from the normalized tables, persists workflow state, owner tasks, a customer-safe message, and customer-visible audit rows.
- The portal projection now sorts owner tasks by `group_order` so the routing string stays stable.
- `npm test` passes.

I tried to commit the change, but the workspace blocked `.git/index.lock` creation, so the branch is still uncommitted. If you want the commit recorded, I can retry once `.git` write access is available.

