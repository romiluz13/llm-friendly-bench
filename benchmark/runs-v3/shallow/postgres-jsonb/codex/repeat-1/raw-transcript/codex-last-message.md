Implemented in [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-jsonb/codex/repeat-1/workspace/src/workflow.mjs).

- It reads the live JSONB `accounts` doc through `withDb`, derives the rescue decision from `src/derive.mjs`, and writes the persisted result in one transaction.
- It now persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`, and clears prior output rows first so reruns stay deterministic.
- Only `src/workflow.mjs` changed.

Verification:
- `node --check src/workflow.mjs` passed.
- `npm test` could not complete in this sandbox because the Postgres socket is blocked here: `connect EPERM 127.0.0.1:5433`.

Next step:
1. Rerun `npm test` in an environment that can reach the live database on `127.0.0.1:5433`.

