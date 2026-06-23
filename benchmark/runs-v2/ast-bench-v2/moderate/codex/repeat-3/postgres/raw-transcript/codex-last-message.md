Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/moderate/codex/repeat-3/postgres/workspace/src/workflow.mjs#L6).

It now:
- reconstructs the strategic-account context from the normalized tables
- upserts workflow state, owner tasks, a customer-safe message, and a customer-visible audit event
- returns the portal projection with the required status: `At-risk escalation active with executive recovery owner routing and customer-visible audit history.`

Validation:
- `npm test` passes
- `npm run render` passes

