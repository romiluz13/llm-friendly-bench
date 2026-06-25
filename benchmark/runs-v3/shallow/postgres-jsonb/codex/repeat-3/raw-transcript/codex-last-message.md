Implemented [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-jsonb/codex/repeat-3/workspace/src/workflow.mjs#L1) so it:
- reads `accounts.doc` from the live Postgres JSONB database,
- derives signals, owner routing, status, `next_step`, and `risk_summary` from `RULES.md`,
- clears and repopulates `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`.

Verification:
- `node --check src/workflow.mjs` passed.
- `npm test` could not complete in this sandbox because the local Postgres socket is blocked: `connect EPERM 127.0.0.1:5433`.

