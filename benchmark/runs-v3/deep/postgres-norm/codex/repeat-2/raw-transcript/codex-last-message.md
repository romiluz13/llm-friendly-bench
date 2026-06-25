Implemented [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/postgres-norm/codex/repeat-2/workspace/src/workflow.mjs) to read raw facts from the live DB, derive status/owners/signals from `RULES.md`, and persist `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in one transaction.

`npm test` is still blocked in this sandbox by `connect EPERM 127.0.0.1:5433`, so I could not complete live-DB verification here.

