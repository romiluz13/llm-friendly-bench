Implemented [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/postgres-jsonb/codex/repeat-2/workspace/src/workflow.mjs:1) so it:

- reads the live `accounts.doc` row through `withDb`
- normalizes the raw facts and derives status, signals, owners, next step, and risk summary from `RULES` via `qualifies`, `signalsOf`, and `ownersOf`
- persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`
- clears prior output rows first so reruns are idempotent

Verification:
- `node --check src/workflow.mjs` passed
- the seeded account derives to the expected escalation: `5 signals`, owners `Legal`, `Finance`, `Customer Success`, `Support`
- `npm test` still cannot complete in this sandbox because the Postgres socket is blocked: `connect EPERM 127.0.0.1:5433`

