Implemented [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/postgres-norm/codex/repeat-2/workspace/src/workflow.mjs) to:

- read the live facts with `readFactsFromDb`
- derive status, owners, next step, and risk summary with `src/derive.mjs`
- clear and repopulate `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` inside a transaction

Checks:
- `node --input-type=module -e "import('./src/workflow.mjs')..."` passed
- `npm test` still fails here before `run()` executes because this sandbox cannot connect to the live Postgres port at `127.0.0.1:5433` (`connect EPERM`)

