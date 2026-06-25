Implemented [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-norm/codex/repeat-2/workspace/src/workflow.mjs) to:

- read the raw facts from the live Postgres tables
- derive status, signals, and owner routing from `src/derive.mjs`
- write `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in a transaction
- clear prior output rows first so reruns stay idempotent
- set the jsonb parser so the benchmark facts reader can parse the shallow lane’s JSON columns

Validation:
- `node -e "import('./src/workflow.mjs')"` passed
- `npm test` still fails here before the DB read with `connect EPERM 127.0.0.1:5433`, which is the sandbox blocking the live Postgres socket

