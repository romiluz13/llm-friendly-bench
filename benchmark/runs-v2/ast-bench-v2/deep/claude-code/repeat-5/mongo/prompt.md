You are running AST-Bench, the Agent Schema Tax Benchmark.

Task:
Strategic account rescue

Business request:
Add an at-risk customer escalation workflow for a delayed high-value order at a strategic account. Combine account tier, contract, support, invoice, usage, shipment, regulatory, and audit context. Route Customer Success, Legal, Finance, and Support. Show a customer-safe portal state and preserve a full audit timeline.

Acceptance:
- The customer-facing status must be "At-risk escalation active with executive recovery owner routing and customer-visible audit history.".
- Persist the workflow state, risk signals, owner tasks, customer message, and audit event.
- Keep the MongoDB document-shaped model native.
- Run npm test and make it pass.

Rules:
- Do not change tests.
- Do not change generated fixture data.
- Do not hand-wave or simulate evidence.
- Make the smallest production-style source change needed.
