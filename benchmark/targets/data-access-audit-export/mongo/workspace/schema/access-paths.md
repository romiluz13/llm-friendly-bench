# Access Paths: Data-access audit export

The coding agent must preserve the same user-visible behavior in both lanes.

Primary entity: audit

Read path:
1. Load the workflow request.
2. Reconstruct account or subject context from benchmark_fixture, accounts, workflow_requests, activities, workflow_state, owner_tasks, audit_events, customer_messages.
3. Resolve owner groups and risk signals.
4. Persist workflow state, owner tasks, customer message, and audit event.
5. Render the portal projection.

Write path:
- Persist one workflow state.
- Persist all required owner tasks.
- Persist one customer-safe message.
- Persist one customer-visible audit event.

Fairness rule:
The lane may stay database-native, but it may not change tests or fixture data.
