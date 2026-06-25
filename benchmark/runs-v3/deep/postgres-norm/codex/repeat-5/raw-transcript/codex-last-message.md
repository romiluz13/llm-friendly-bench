Implemented [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/postgres-norm/codex/repeat-5/workspace/src/workflow.mjs) to:

- read the raw facts from the live Postgres tables,
- derive qualification, signals, owners, status, next step, and risk summary from `src/derive.mjs`,
- clear and repopulate `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in one transaction.

I ran `npm test`, but this sandbox blocks the live Postgres connection (`connect EPERM 127.0.0.1:5433`), so I could not complete end-to-end verification here.

