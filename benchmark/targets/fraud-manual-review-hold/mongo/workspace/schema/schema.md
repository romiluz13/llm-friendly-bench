# Schema Contract: Fraud/manual-review hold

Lane: mongo

Business prompt:
Create a manual-review hold workflow for a suspicious high-value order. Combine payment risk, account history, shipping, support, product mix, audit events, and customer-safe visibility rules.

Expected outcome:
Manual review hold active with risk evidence, review owners, and portal-safe status.

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
