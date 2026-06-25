Implemented [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/mongo/codex/repeat-5/workspace/src/workflow.mjs): it now reads the live account through `withDb`, derives qualification/signals/owners from `src/derive.mjs`, clears the four output collections, and persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in the rule-driven shape.

Validation:
- `node --check src/workflow.mjs` passed.
- `npm test` still fails in this sandbox because the Node MongoDB driver cannot connect to `127.0.0.1:27018` here (`MongoServerSelectionError: connect EPERM`), so I could not get a green local run from this environment.

