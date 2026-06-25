Implemented [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/mongo/codex/repeat-1/workspace/src/workflow.mjs) to:
- read the live account from `accounts`
- derive status, risk signals, and owner routing with `src/derive.mjs`
- clear and rewrite `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`
- persist the qualifying escalation branch with the rule-compliant status, next step, risk summary, ordered owner tasks, customer-safe message, and customer-visible audit event

`node --check src/workflow.mjs` passes.

`npm test` still fails in this sandbox before the workflow runs because Node cannot connect to the live Mongo socket at `127.0.0.1:27018` (`MongoServerSelectionError: connect EPERM`).

