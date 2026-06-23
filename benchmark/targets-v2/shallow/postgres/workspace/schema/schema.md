# Schema Contract: Strategic account rescue

Lane: postgres

Business prompt:
Add an at-risk customer escalation workflow for a delayed high-value order at a strategic account. Combine account tier, contract, support, invoice, usage, shipment, regulatory, and audit context. Route Customer Success, Legal, Finance, and Support. Show a customer-safe portal state and preserve a full audit timeline.

Expected outcome:
At-risk escalation active with executive recovery owner routing and customer-visible audit history.

Native data shape:
Normalized tables keep entity boundaries explicit and require joins/reconstruction in workflow code.

Objects:
- benchmark_fixture: 1 table rows, fields: fixture_version, suite_id, task_id, generated_at
- accounts: 1 table rows, fields: account_id, name, tier, region, contract_id, renewal_date, arr_cents, support_plan
- contacts: 2 table rows, fields: contact_id, account_id, role, email
- workflow_requests: 1 table rows, fields: request_id, task_id, account_id, title, primary_entity, expected_outcome, next_step, customer_message, owner_groups, risk_signals
- workflow_state: 0 table rows, fields: scalar
- owner_tasks: 0 table rows, fields: scalar
- audit_events: 0 table rows, fields: scalar
- customer_messages: 0 table rows, fields: scalar
