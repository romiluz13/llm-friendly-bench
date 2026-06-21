# Schema Contract: Legal hold workflow

Lane: mongo

Business prompt:
Build a legal hold workflow that freezes relevant account, order, case, invoice, activity, and audit records while preserving customer-safe operational status.

Expected outcome:
Legal hold active with scoped records, legal owner, and immutable audit timeline.

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
