Implemented [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-norm/codex/repeat-1/workspace/src/workflow.mjs) so it now:

- imports `pg` and disables JSONB auto-parsing at module load
- reads the live `workflow_requests` and `accounts` rows
- derives qualification, signals, owners, status, next step, and risk summary from `RULES.md`
- clears any prior output for the same request/account
- persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in a transaction

I also verified the module loads and the JSONB parser override is active.

`npm test` could not complete in this sandbox because the local Postgres socket is blocked here: `connect EPERM 127.0.0.1:5433`. So the code is in place, but I could not finish live-DB verification from this environment.

