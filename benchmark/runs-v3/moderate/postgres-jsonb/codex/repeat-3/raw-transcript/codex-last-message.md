Implemented [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/postgres-jsonb/codex/repeat-3/workspace/src/workflow.mjs) to:
- read the live JSONB account doc from `accounts`
- derive status, owners, and risk summary via `src/derive.mjs`
- clear prior rows for that account
- persist `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in one transaction

Checks:
- `node --check src/workflow.mjs` passed
- `npm test` still fails in this sandbox because TCP to `127.0.0.1:5433` is blocked with `EPERM`, so I could not complete live-db verification here

