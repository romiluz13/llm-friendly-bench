Implemented the at-risk Customer 360 escalation workflow in [src/order-exception-workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/instrumented-agent-runs/order-exception-codex-v1/mongo/workspace/src/order-exception-workflow.mjs).

It now detects the six required risk signals from the existing document-shaped collections, persists the escalation, four owner tasks, customer-safe portal message, linked audit events, and account/order escalation state. Fixtures and tests were not changed.

Verification: `npm test` passes.