# Schema Contract: Strategic account rescue

Lane: mongo

Business prompt:
Add an at-risk customer escalation workflow for a delayed high-value order at a strategic account. Combine account tier, contract, support, invoice, usage, shipment, regulatory, and audit context. Route Customer Success, Legal, Finance, and Support. Show a customer-safe portal state and preserve a full audit timeline.

Expected outcome:
At-risk escalation active with executive recovery owner routing and customer-visible audit history.

Native data shape:
Document-shaped collections keep hot workflow context close to the customer and subject records.

Objects:
- benchmark_fixture: 1 document group, fields: _id, suiteId, taskId, generatedAt
- accounts: 1 document group, fields: _id, name, tier, region, contract, contacts, context
- workflow_requests: 1 document group, fields: _id, taskId, accountId, title, primaryEntity, businessPrompt, expectedOutcome, ownerGroups, riskSignals, nextStep, customerMessage
- activities: 6 document group, fields: _id, accountId, subjectId, summary, occurredAt
- workflow_state: 0 document group, fields: scalar
- owner_tasks: 0 document group, fields: scalar
- audit_events: 0 document group, fields: scalar
- customer_messages: 0 document group, fields: scalar
