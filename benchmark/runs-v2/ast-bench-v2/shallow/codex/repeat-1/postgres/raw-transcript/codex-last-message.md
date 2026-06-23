Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-1/postgres/workspace/src/workflow.mjs) and [src/portal-view.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-1/postgres/workspace/src/portal-view.mjs):

- `applyBenchmarkTask` now persists a flat workflow state row, one owner task per routed group, a customer-safe message, and a customer-visible audit event.
- The persisted state carries the expected outcome/status, owner routing, risk signals, and an audit timeline built from the normalized account and contact context.
- The portal projection now reads persisted risk signals and message state when present.

Validation:
- `npm test`
- `npm run render`

