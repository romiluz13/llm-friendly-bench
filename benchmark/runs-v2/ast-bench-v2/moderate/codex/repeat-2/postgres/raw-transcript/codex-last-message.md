Implemented the workflow in source only.

- [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/moderate/codex/repeat-2/postgres/workspace/src/workflow.mjs#L3-L106) now upserts the workflow state, owner tasks, customer message, and customer-visible audit event from the normalized account/contract/contact/activity tables. It preserves the required status string and carries the account, contract, risk, and audit context into persisted rows.
- [src/portal-view.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/moderate/codex/repeat-2/postgres/workspace/src/portal-view.mjs#L1-L24) now sorts owner tasks by route order before rendering so the portal owner string stays deterministic.

Validation:
- `npm test`
- `npm run render`

