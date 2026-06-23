Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/moderate/codex/repeat-3/mongo/workspace/src/workflow.mjs#L1): it now persists the workflow state, owner tasks, a customer-safe portal message, and a customer-visible audit event with the full activity timeline. The portal projection now reaches the required customer-facing status.

`npm test` passes.

`git commit` was blocked by a permissions error writing `.git/index.lock`, so the change is left in the working tree.

