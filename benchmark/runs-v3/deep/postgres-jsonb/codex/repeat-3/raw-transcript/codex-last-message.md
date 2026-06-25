Implemented `src/workflow.mjs` to read the live JSONB account doc through `withDb`, derive the rescue outcome with `src/derive.mjs`, and persist fresh rows into `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` inside a transaction. The workflow now clears stale output rows first, so reruns stay idempotent.

`node --check src/workflow.mjs` passes.

`npm test` still cannot complete in this sandbox because the live Postgres socket is blocked here: `connect EPERM 127.0.0.1:5433`. The code is in place for the live DB, but I could not verify it end-to-end from this environment.

