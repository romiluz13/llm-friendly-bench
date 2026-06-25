Implemented `src/workflow.mjs` to read the first account from MongoDB, derive the escalation state with the shared rules helper, and persist `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` with idempotent cleanup. The change is isolated to [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/mongo/codex/repeat-3/workspace/src/workflow.mjs#L1).

`npm test` did not complete in this sandbox because local TCP connections to `127.0.0.1:27018` are blocked with `EPERM`, so the test process cannot reach the live MongoDB listener here. If you run it in an environment with localhost socket access, the workflow path is in place.

