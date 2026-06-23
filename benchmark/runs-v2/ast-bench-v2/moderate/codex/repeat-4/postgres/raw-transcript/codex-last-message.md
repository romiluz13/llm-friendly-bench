Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/moderate/codex/repeat-4/postgres/workspace/src/workflow.mjs#L13). It now reconstructs the normalized account/contract/contact/activity context, persists workflow state, ordered owner tasks, a customer-safe message, and a customer-visible audit timeline, while keeping the required status string intact.

Validation:
- `npm test` passed
- `npm run render` passed

