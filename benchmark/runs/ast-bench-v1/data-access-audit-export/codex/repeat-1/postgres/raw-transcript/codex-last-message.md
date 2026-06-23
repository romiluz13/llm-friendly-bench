Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/data-access-audit-export/codex/repeat-1/postgres/workspace/src/workflow.mjs#L8) with the summary/hash helpers at [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/data-access-audit-export/codex/repeat-1/postgres/workspace/src/workflow.mjs#L119).

- The workflow now reconstructs the normalized Postgres tables, computes a hashable audit trail, and persists the workflow state, owner tasks, customer message, and customer-visible audit event.
- The customer-facing status now resolves to the required ready string, and the persisted rows stay in the native relational tables already present in `data/`.

Verification:
- `npm test` passed.

