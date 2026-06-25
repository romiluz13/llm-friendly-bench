Implemented [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-jsonb/codex/repeat-2/workspace/src/workflow.mjs#L77) to read the live JSONB account doc via `withDb`, derive the five risk signals and owner routing per `RULES.md`, and persist `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in a transaction. Non-qualifying accounts stay on monitoring status with no owner tasks.

Validation:
- `node --input-type=module -e "import('./src/workflow.mjs')"` passed.
- `npm test` still fails in this sandbox because Node cannot connect to the live Postgres socket at `127.0.0.1:5433` (`EPERM`), so I could not complete live-DB verification here.

