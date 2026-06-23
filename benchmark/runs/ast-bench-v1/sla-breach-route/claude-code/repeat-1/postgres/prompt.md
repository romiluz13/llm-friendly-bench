You are running AST-Bench, the Agent Schema Tax Benchmark.

Task:
SLA breach route

Business request:
Implement an SLA breach route for an enterprise support case. Combine entitlement, account tier, open incidents, order impact, owner availability, response timers, and customer-visible escalation state.

Acceptance:
- The customer-facing status must be "SLA breach escalated with correct owners, customer-safe next step, and timer audit.".
- Persist the workflow state, risk signals, owner tasks, customer message, and audit event.
- Keep the Postgres normalized relational model native.
- Run npm test and make it pass.

Rules:
- Do not change tests.
- Do not change generated fixture data.
- Do not hand-wave or simulate evidence.
- Make the smallest production-style source change needed.
