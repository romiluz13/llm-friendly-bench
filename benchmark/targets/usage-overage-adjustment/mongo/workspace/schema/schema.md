# Schema Contract: Usage overage adjustment

Lane: mongo

Business prompt:
Implement a usage overage adjustment workflow. Combine product usage, contract entitlements, invoice lines, customer tier, support context, credit policy, and audit records.

Expected outcome:
Overage adjustment proposed with policy evidence, owner tasks, and customer-safe status.

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
