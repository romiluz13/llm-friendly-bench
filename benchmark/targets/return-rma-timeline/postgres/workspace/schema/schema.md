# Schema Contract: Return/RMA timeline

Lane: postgres

Business prompt:
Build a return authorization timeline for a customer order. Combine original order, shipment, product, warranty, support case, payment adjustment, owner tasks, and audit history.

Expected outcome:
RMA timeline active with replacement/refund decision path and complete audit state.

Native data shape:
Normalized tables keep entity boundaries explicit and require joins/reconstruction in workflow code.

Objects:
- benchmark_fixture: 1 table rows, fields: fixture_version, suite_id, task_id, generated_at
- accounts: 1 table rows, fields: account_id, name, tier, region
- account_contracts: 1 table rows, fields: contract_id, account_id, renewal_date, arr_cents, support_plan
- contacts: 2 table rows, fields: contact_id, account_id, role, email
- workflow_requests: 1 table rows, fields: request_id, task_id, account_id, title, primary_entity, expected_outcome, next_step, customer_message
- workflow_request_owner_groups: 4 table rows, fields: request_id, owner_group, group_order
- workflow_request_risk_signals: 5 table rows, fields: request_id, signal_name, detail, signal_order
- activities: 5 table rows, fields: activity_id, account_id, subject_id, summary, occurred_at
- workflow_state: 0 table rows, fields: scalar
- owner_tasks: 0 table rows, fields: scalar
- audit_events: 0 table rows, fields: scalar
- customer_messages: 0 table rows, fields: scalar
