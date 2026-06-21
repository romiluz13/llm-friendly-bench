# Schema Contract: Executive escalation summary

Lane: mongo

Business prompt:
Build an executive escalation summary that joins account context, open orders, cases, invoices, contract status, recent activity, and audit history into one customer-safe briefing.

Expected outcome:
Executive summary published with complete evidence links and customer-visible status.

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
