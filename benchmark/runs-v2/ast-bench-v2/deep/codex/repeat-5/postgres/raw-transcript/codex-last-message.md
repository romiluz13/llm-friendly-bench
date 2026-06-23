Implemented the workflow so the Postgres target now persists the request-scoped state, routed owner tasks, customer-safe message, and customer-visible audit event from the normalized tables.

- [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/deep/codex/repeat-5/postgres/workspace/src/workflow.mjs#L6) now joins `accounts`, `account_contracts`, `support_plans`, `invoice_risk`, `account_addresses`, `workflow_request_owner_groups`, `workflow_request_risk_signals`, `activities`, `contact_x_owner_group`, and `contacts`, then writes the workflow rows back into `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`.
- [src/portal-view.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/deep/codex/repeat-5/postgres/workspace/src/portal-view.mjs#L1) now reads the latest persisted state/message and keeps owner routing order stable.
- Verification passed with `npm test`, `npm run render`, and `git diff --check`.

