Implemented [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-jsonb/codex/repeat-4/workspace/src/workflow.mjs).

- It now reads the live JSONB account doc through `withDb`, derives status/owners/signals via `src/derive.mjs`, and writes `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in one transaction.
- It clears prior output rows first, uses the derived owner order, and only writes the customer message and customer-visible audit event when the account qualifies.

Verification:
- `node --input-type=module` import check passed.
- `npm test` did not reach the workflow logic in this shell because Postgres connection setup failed with `connect EPERM 127.0.0.1:5433`.
- `git status` shows only `src/workflow.mjs` changed.

