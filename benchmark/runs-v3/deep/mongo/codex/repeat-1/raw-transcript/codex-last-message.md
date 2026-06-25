Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/mongo/codex/repeat-1/workspace/src/workflow.mjs#L1) and [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/mongo/codex/repeat-1/workspace/src/workflow.mjs#L143):

- Reads the live account from MongoDB, derives the five risk signals, escalation status, owner routing, risk summary, and next step from `RULES.md`.
- Clears and rewrites `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` so the persisted state stays deterministic.
- Persists customer-safe messaging and a customer-visible audit event.

Validation:
- `node --check src/workflow.mjs` passed.
- `node -e "import('./src/workflow.mjs')"` passed.
- `npm test` could not complete in this sandbox because the local Mongo socket is blocked: `MongoServerSelectionError: connect EPERM 127.0.0.1:27018`.

