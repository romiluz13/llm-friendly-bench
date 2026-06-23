Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-5/mongo/workspace/src/workflow.mjs).

- The workflow now persists a native Mongo-style `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`.
- It combines account, contract, support, invoice, usage, shipment, regulatory, and audit context into the state document.
- The portal projection now reaches the required customer-facing status and customer-visible audit history.

`npm test` passes.

I couldn’t create a git commit here because the sandbox blocked `.git/index.lock` creation in this repo.

