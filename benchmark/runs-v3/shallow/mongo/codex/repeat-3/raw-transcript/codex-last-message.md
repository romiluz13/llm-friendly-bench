Implemented the workflow in [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/mongo/codex/repeat-3/workspace/src/workflow.mjs).

- It now reads the live account through `withDb`.
- It reuses the pure rule helpers from `src/derive.mjs` to derive status, risk summary, owner routing, and next step from raw facts.
- It persists fresh results into `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` idempotently by clearing and repopulating those collections.
- It keeps the customer-facing text free of internal ids/codes and uses the derived owners/order from the rules.

Verification:
- `node --check src/workflow.mjs` passed.
- `npm test` did not complete in this workspace because the Node process cannot reach the benchmark MongoDB socket: `MongoServerSelectionError: connect EPERM 127.0.0.1:27018`.

