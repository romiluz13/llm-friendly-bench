Implemented [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/postgres-norm/codex/repeat-5/workspace/src/workflow.mjs):
- reads raw facts from the live normalized tables
- derives status, owners, signals, and next step via `src/derive.mjs`
- deletes and repopulates `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`
- uses schema-tolerant inserts so extra columns are filled when present and ignored when absent
- writes one customer-safe message and one customer-visible audit event

Validation:
- `node --check src/workflow.mjs` passes
- `npm test` could not complete in this shell because TCP to `127.0.0.1:5433` is blocked with `EPERM`, so live DB verification is still pending

1. Rerun `npm test` in an environment that can reach the local Postgres listener.

