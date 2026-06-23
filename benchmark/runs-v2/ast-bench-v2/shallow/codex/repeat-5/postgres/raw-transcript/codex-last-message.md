Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-5/postgres/workspace/src/workflow.mjs#L1) only.

- Persists the workflow state with account tier, contract/support context, routed owners, parsed risk signals, customer message, and audit timeline.
- Inserts one open owner task per routed group, a customer-safe message, and a customer-visible audit event.
- `npm test` passes.

