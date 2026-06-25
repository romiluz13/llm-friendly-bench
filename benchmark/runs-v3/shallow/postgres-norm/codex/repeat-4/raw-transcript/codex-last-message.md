Implemented [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-norm/codex/repeat-4/workspace/src/workflow.mjs#L6) to:
- read the shallow Postgres facts from `workflow_requests` and `accounts`
- derive `status`, `riskSummary`, `owners`, and `nextStep` via [`src/derive.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-norm/codex/repeat-4/workspace/src/derive.mjs#L4)
- clear and repopulate `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in one transaction
- persist the customer message and customer-visible audit event only when the account qualifies

Validation:
- `node --input-type=module -e "import('./src/workflow.mjs')"` passed
- `npm test` could not complete here because this sandbox blocks the Postgres TCP connection: `Error: connect EPERM 127.0.0.1:5433 - Local (0.0.0.0:0)`

`git status --short` shows only `M src/workflow.mjs`.