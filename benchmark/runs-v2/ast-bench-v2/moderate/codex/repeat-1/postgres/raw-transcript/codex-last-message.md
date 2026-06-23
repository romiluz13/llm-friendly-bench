Implemented the Postgres workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/moderate/codex/repeat-1/postgres/workspace/src/workflow.mjs#L5) and the persistence helpers in the same file ([src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/moderate/codex/repeat-1/postgres/workspace/src/workflow.mjs#L29)). The workflow now:
- reconstructs account, contract, contact, owner-routing, and signal context from the normalized tables,
- persists workflow state, owner tasks, a customer-safe portal message, and a customer-visible audit timeline,
- returns the updated portal projection with the expected at-risk status.

`npm test` passes.

Git commit was not completed in this sandbox because git could not create lock/temp files (`.git/index.lock` and a temp file both failed with `Operation not permitted`).

