# Schema Contract: SLA breach route

Lane: mongo

Business prompt:
Implement an SLA breach route for an enterprise support case. Combine entitlement, account tier, open incidents, order impact, owner availability, response timers, and customer-visible escalation state.

Expected outcome:
SLA breach escalated with correct owners, customer-safe next step, and timer audit.

Native data shape:
Document-shaped collections keep hot workflow context close to the customer and subject records.

Objects:
- benchmark_fixture: 1 document group, fields: _id, suiteId, taskId, generatedAt
- accounts: 1 document group, fields: _id, name, tier, region, contract, contacts, context
- workflow_requests: 1 document group, fields: _id, taskId, accountId, title, primaryEntity, businessPrompt, expectedOutcome, ownerGroups, riskSignals, nextStep, customerMessage
- activities: 5 document group, fields: _id, accountId, subjectId, summary, occurredAt
- workflow_state: 0 document group, fields: scalar
- owner_tasks: 0 document group, fields: scalar
- audit_events: 0 document group, fields: scalar
- customer_messages: 0 document group, fields: scalar
