You are running an Instrumented Agent Run for MongoDB's Interactive Proof Lab.

Task:
Implement the at-risk Customer 360 Escalation Workflow for order HX-20491 / account acct-nova.

Business request:
Detect a delayed high-value order for a strategic account, combine CRM context, open support cases, invoice/payment risk, contract tier, recent product usage, shipment status, regulatory flags, and audit history. Route the account to Customer Success, Legal, Finance, and Support, show the customer-safe status in the portal, create internal owner tasks, and preserve a full audit timeline.

Acceptance:
- The customer portal title is "At-risk escalation active".
- Current status is "Executive escalation".
- Visible owner is "Customer Success + Legal + Finance + Support".
- Next step is "Executive recovery plan by 16:00".
- Risk summary is "6 signals: shipment delay, strategic account, open support case, invoice risk, usage drop, regulatory review".
- Tasks is "4 owner tasks".
- Audit history is visible.
- Customer message is "We are coordinating executive recovery for your delayed shipment."
- Persist the escalation state, all six risk factors with detail, four owner tasks with account/order/title/due context, customer portal message, and audit linkage.
- Run npm test and make it pass.

Rules:
- Do not change tests.
- Do not change generated fixture data.
- Keep the Postgres normalized table-shaped model native.
- Make the smallest production-style code change needed.
