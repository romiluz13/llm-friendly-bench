Implemented `src/workflow.mjs` to read the live account through `withDb`, derive qualification/signals/owners from `src/derive.mjs`, and persist the benchmark’s four target collections with the expected schema. See [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/mongo/codex/repeat-5/workspace/src/workflow.mjs#L4) and [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/mongo/codex/repeat-5/workspace/src/workflow.mjs#L26).

I verified the module imports cleanly and the pure derivation matches the live account, but `npm test` cannot complete in this sandbox because Node is blocked from connecting to MongoDB at `127.0.0.1:27018`:

`MongoServerSelectionError: connect EPERM 127.0.0.1:27018 - Local (0.0.0.0:0)`

