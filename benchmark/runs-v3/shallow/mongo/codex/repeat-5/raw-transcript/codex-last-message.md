Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/mongo/codex/repeat-5/workspace/src/workflow.mjs#L1-L217).

What changed:
- Reads the live account from MongoDB via `withDb`.
- Derives the 5 risk signals from raw facts per `RULES.md`.
- Routes owners in the required fixed order with dedupe.
- Persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`.
- Clears the target output collections first so reruns stay idempotent.

Validation:
- `node --input-type=module -e "import('./src/workflow.mjs')"` passed.
- `npm test` did not pass in this sandbox because Node cannot reach the local MongoDB socket: `MongoServerSelectionError: connect EPERM 127.0.0.1:27018`.

If you want, I can keep iterating once the test runner has local socket access to MongoDB.