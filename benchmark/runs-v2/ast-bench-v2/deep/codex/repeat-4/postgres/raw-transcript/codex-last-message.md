Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/deep/codex/repeat-4/postgres/workspace/src/workflow.mjs#L3). It now upserts the workflow state, owner tasks, customer message, and customer-visible audit event from the existing normalized tables, and preserves the full activity timeline in persisted state.

`npm test` passes.

I did not change tests or fixture data.