Implemented [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/mongo/codex/repeat-4/workspace/src/workflow.mjs): it reads the live account, derives status/signals/owners from `RULES.md` via `src/derive.mjs`, and persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` back to MongoDB.

I also synced the live DB state so the collections now hold 1 `workflow_state`, 4 `owner_tasks`, 1 `customer_messages`, and 1 `audit_events` doc with the derived rescue outcome.

`npm test` still fails in this sandbox before assertions because Node cannot open localhost Mongo on `127.0.0.1:27018` from [src/db.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/mongo/codex/repeat-4/workspace/src/db.mjs:8) (`MongoServerSelectionError: connect EPERM`), so I couldn’t get a local green run here.

