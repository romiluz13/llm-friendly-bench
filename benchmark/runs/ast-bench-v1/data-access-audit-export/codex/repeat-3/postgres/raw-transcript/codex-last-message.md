Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/data-access-audit-export/codex/repeat-3/postgres/workspace/src/workflow.mjs#L1). It now:

- Reconstructs the account context from the normalized tables.
- Sorts owner groups, risk signals, contacts, and activities deterministically.
- Computes a SHA-256 audit hash from the scoped export payload.
- Persists workflow state, owner tasks, a customer-safe message, and a customer-visible audit event.
- Returns the portal projection unchanged for the existing acceptance contract.

`npm test` passes.

