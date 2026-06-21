# Schema Contract: Payment-risk hold release

Lane: postgres

Business prompt:
Create a payment-risk hold release workflow for an order blocked by invoice/payment status. Combine payment events, account tier, contract, open cases, order value, and approval audit.

Expected outcome:
Hold release review active with finance/legal owners and customer-safe next step.

Native data shape:
Normalized tables keep entity boundaries explicit and require joins/reconstruction in workflow code.

Objects:
- benchmark_fixture: 1 table rows, fields: fixture_version, suite_id, task_id, generated_at
- accounts: 1 table rows, fields: account_id, name, tier, region
- account_contracts: 1 table rows, fields: contract_id, account_id, renewal_date, arr_cents, support_plan
- contacts: 2 table rows, fields: contact_id, account_id, role, email
- workflow_requests: 1 table rows, fields: request_id, task_id, account_id, title, primary_entity, expected_outcome, next_step, customer_message
- workflow_request_owner_groups: 4 table rows, fields: request_id, owner_group, group_order
- workflow_request_risk_signals: 6 table rows, fields: request_id, signal_name, detail, signal_order
- activities: 6 table rows, fields: activity_id, account_id, subject_id, summary, occurred_at
- workflow_state: 0 table rows, fields: scalar
- owner_tasks: 0 table rows, fields: scalar
- audit_events: 0 table rows, fields: scalar
- customer_messages: 0 table rows, fields: scalar
