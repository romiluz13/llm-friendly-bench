Implemented the workflow in source only and kept the Postgres-style tables normalized.

- [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-2/postgres/workspace/src/workflow.mjs#L3) now reconstructs the account context, derives the risk summary, writes one workflow state row, one customer-safe message, one customer-visible audit event, and four owner tasks, then returns the portal projection.
- [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-2/postgres/workspace/src/workflow.mjs#L84) uses request-scoped row replacement so the write path does not wipe unrelated rows.
- [src/portal-view.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-2/postgres/workspace/src/portal-view.mjs#L1) now prefers the persisted risk summary when workflow state exists, while keeping the before-state unchanged.

Validation:
- `npm test` passed.

Self-review: no blocking issues found.