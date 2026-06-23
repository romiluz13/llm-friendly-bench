Implemented in [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/split-shipment-exception/codex/repeat-3/mongo/workspace/src/workflow.mjs#L3).

- Persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` from the existing request, account, and activity documents.
- Sets the exact customer-facing status from `workflow_requests.expectedOutcome`.
- Carries forward risk signals, owner routing, customer message, support-case context, and the audit timeline in native document-shaped collections.

`npm test` passes.

