Implemented `src/workflow.mjs` to read the live JSONB account doc, derive the escalation outcome from the existing rule helpers in `src/derive.mjs`, and persist `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` back to the live account rows. The change is in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/postgres-jsonb/codex/repeat-2/workspace/src/workflow.mjs#L1).

- `node --check src/workflow.mjs` passes.
- `npm test` still cannot complete in this sandbox because Node is blocked from connecting to the benchmark Postgres port: `connect EPERM 127.0.0.1:5433`.
- I did verify the derivation locally against the benchmark oracle on the seeded account; it matches the expected status, owners, and risk summary.

