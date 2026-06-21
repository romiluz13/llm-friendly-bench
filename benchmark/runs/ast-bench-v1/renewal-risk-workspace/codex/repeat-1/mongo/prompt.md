You are running AST-Bench, the Agent Schema Tax Benchmark.

Task:
Renewal-risk workspace

Business request:
Create a renewal-risk workspace for an enterprise account whose usage dropped while support volume and invoice risk increased. Combine account, contacts, contract renewal, support, invoice, product usage, owner tasks, and audit history.

Acceptance:
- The customer-facing status must be "Renewal risk workspace active with owner tasks, customer-safe next step, and persisted risk factors.".
- Persist the workflow state, risk signals, owner tasks, customer message, and audit event.
- Keep the MongoDB document-shaped model native.
- Run npm test and make it pass.

Rules:
- Do not change tests.
- Do not change generated fixture data.
- Do not hand-wave or simulate evidence.
- Make the smallest production-style source change needed.
