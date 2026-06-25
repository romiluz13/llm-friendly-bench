Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/postgres-norm/codex/repeat-3/workspace/src/workflow.mjs#L8): it reads the live facts, derives status/owners/signals with the shared rule helpers, clears stale output rows, and persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in one transaction.

I validated the pure rule derivation locally against the benchmark oracle, but `npm test` from this shell still fails before the app code runs because the sandbox blocks the live Postgres socket at `127.0.0.1:5433` (`connect EPERM`), so I could not complete an on-socket acceptance pass here.

