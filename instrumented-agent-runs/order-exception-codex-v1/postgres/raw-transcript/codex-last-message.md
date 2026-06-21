Implemented in [src/order-exception-workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/instrumented-agent-runs/order-exception-codex-v1/postgres/workspace/src/order-exception-workflow.mjs:3).

The workflow now persists the escalation, six detailed risk factors, four owner tasks, task assignments, portal message, legal/finance review requests, and customer-visible audit linkage using the existing normalized table arrays. Tests and fixture data were not changed.

Verification: `npm test` passes.