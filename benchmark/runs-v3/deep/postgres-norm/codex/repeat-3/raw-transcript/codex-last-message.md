Implemented [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/postgres-norm/codex/repeat-3/workspace/src/workflow.mjs) to read the live normalized facts, derive status/owners/signals through `src/derive.mjs`, and persist `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in one transaction.

`node --check src/workflow.mjs` passed. `npm test` still fails here with `connect EPERM 127.0.0.1:5433`, so I could not complete live-DB verification from this sandbox.

