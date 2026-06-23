You are running AST-Bench, the Agent Schema Tax Benchmark.

Task:
Data-access audit export

Business request:
Implement a data-access audit export workflow for a regulated account. Combine user access, account records, support cases, order events, compliance reviews, approval history, and export status.

Acceptance:
- The customer-facing status must be "Audit export ready with scoped records, approvers, customer-safe summary, and hashable audit trail.".
- Persist the workflow state, risk signals, owner tasks, customer message, and audit event.
- Keep the Postgres normalized relational model native.
- Run npm test and make it pass.

Rules:
- Do not change tests.
- Do not change generated fixture data.
- Do not hand-wave or simulate evidence.
- Make the smallest production-style source change needed.
