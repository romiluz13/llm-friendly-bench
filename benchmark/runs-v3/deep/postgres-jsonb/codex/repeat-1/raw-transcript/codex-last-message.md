Implemented [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/postgres-jsonb/codex/repeat-1/workspace/src/workflow.mjs#L1).

What it does:
- Reads the JSONB account doc through `withDb`
- Derives status, signals, and owners from `src/derive.mjs`
- Persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`
- Clears stale output rows first and wraps the write in a transaction

Validation:
- `node --check src/workflow.mjs` passed
- A local derivation check against the seeded account matched the expected escalation output
- `npm test` could not complete in this sandbox because the live Postgres socket is blocked here: `connect EPERM 127.0.0.1:5433`

