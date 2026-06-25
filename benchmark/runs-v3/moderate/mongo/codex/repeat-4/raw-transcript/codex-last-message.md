Implemented `run()` in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/mongo/codex/repeat-4/workspace/src/workflow.mjs): it now reads the live account, derives qualification/signals/owners from `derive.mjs`, clears stale output docs, and persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in the benchmark’s expected shape.

I ran `npm test`, but this sandbox cannot open loopback sockets, so MongoDB connection attempts fail before the acceptance test can read the live DB: `MongoServerSelectionError: connect EPERM 127.0.0.1:27018`. The code change is in place; the remaining blocker here is the environment, not the workflow logic.

