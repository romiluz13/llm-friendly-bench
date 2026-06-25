Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/postgres-jsonb/codex/repeat-5/workspace/src/workflow.mjs).

What it does:
- Reads the live JSONB account doc through `withDb`.
- Derives qualification, active signals, owner routing, status, `next_step`, and `risk_summary` directly from `RULES.md`.
- Writes `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` inside one transaction.
- Keeps the persisted output deterministic and customer-safe.

Verification:
- `node --check src/workflow.mjs` passed.
- `node -e "import('./src/workflow.mjs')..."` passed.
- `npm test` could not complete in this sandbox because the Postgres socket is blocked here: `connect EPERM 127.0.0.1:5433`.

