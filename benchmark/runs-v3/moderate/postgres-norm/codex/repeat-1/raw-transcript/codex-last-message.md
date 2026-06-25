Implemented [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/postgres-norm/codex/repeat-1/workspace/src/workflow.mjs): it now reads the live facts from Postgres, derives status/owners/signals via `src/derive.mjs`, and persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` back into the benchmark tables.

`node --input-type=module -e "import('./src/workflow.mjs')"` passes. `npm test` still cannot complete in this sandbox because the local Postgres connection is blocked at `127.0.0.1:5433` with `connect EPERM`, so I could not verify the live DB path here.

