Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-norm/codex/repeat-5/workspace/src/workflow.mjs#L6). It now reads the raw Postgres facts, derives qualification/owners/signals through `src/derive.mjs`, clears stale output rows, and persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in one transaction.

`node --check src/workflow.mjs` passes.

I could not complete `npm test` in this sandbox because the local Postgres socket is blocked: `connect EPERM 127.0.0.1:5433`.

