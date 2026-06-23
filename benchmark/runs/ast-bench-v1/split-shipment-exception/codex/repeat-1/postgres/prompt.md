You are running AST-Bench, the Agent Schema Tax Benchmark.

Task:
Split-shipment exception

Business request:
Implement a split-shipment exception workflow for a high-value order where partial fulfillment, carrier delay, inventory reservation, account tier, support case, and audit timeline must be reconciled.

Acceptance:
- The customer-facing status must be "Split-shipment exception active with replacement plan, owners, customer message, and audit trail.".
- Persist the workflow state, risk signals, owner tasks, customer message, and audit event.
- Keep the Postgres normalized relational model native.
- Run npm test and make it pass.

Rules:
- Do not change tests.
- Do not change generated fixture data.
- Do not hand-wave or simulate evidence.
- Make the smallest production-style source change needed.
