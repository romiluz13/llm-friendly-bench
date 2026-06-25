Implemented [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/postgres-norm/codex/repeat-4/workspace/src/workflow.mjs):

- Reads raw facts from the live Postgres schema via `readFactsFromDb`.
- Derives status, owner routing, and risk signals with the repo’s own `src/derive.mjs` helpers.
- Clears and repopulates `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in one transaction so repeated runs stay deterministic.
- Writes the customer message and audit event only when the account qualifies for escalation.

Verification:
- `node --input-type=module -e "import('./src/workflow.mjs')..."` loads cleanly.
- `npm test` still fails in this sandbox before the workflow runs with `connect EPERM 127.0.0.1:5433`, so I could not get a passing live-DB test run from this environment.

