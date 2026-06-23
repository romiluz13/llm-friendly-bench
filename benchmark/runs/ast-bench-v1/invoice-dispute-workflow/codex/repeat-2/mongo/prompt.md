You are running AST-Bench, the Agent Schema Tax Benchmark.

Task:
Invoice dispute workflow

Business request:
Implement an invoice dispute workflow that combines account contract, invoice lines, order fulfillment, support evidence, payment history, owner approvals, and audit events.

Acceptance:
- The customer-facing status must be "Invoice dispute active with finance owner, evidence bundle, and customer-safe status.".
- Persist the workflow state, risk signals, owner tasks, customer message, and audit event.
- Keep the MongoDB document-shaped model native.
- Run npm test and make it pass.

Rules:
- Do not change tests.
- Do not change generated fixture data.
- Do not hand-wave or simulate evidence.
- Make the smallest production-style source change needed.
