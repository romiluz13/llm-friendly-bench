Implemented the SLA breach route in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/sla-breach-route/codex/repeat-1/postgres/workspace/src/workflow.mjs:1).

What changed:
- Reconstructs the case context from the native tables.
- Persists one workflow state row with the expected customer-facing status, customer-safe next step, entitlement/tier context, and timer audit.
- Persists ordered owner tasks, a customer message, and a customer-visible audit event.
- Returns the portal projection from the mutated tables, so the acceptance view sees the persisted state.

Validation:
- `npm test` passed.
- `npm run render` completed successfully.

The workspace is left with only the source edit in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/sla-breach-route/codex/repeat-1/postgres/workspace/src/workflow.mjs:1).

