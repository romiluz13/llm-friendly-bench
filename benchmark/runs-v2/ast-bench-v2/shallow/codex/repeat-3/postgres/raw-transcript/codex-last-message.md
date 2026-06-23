Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-3/postgres/workspace/src/workflow.mjs#L1) and [src/portal-view.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/shallow/codex/repeat-3/postgres/workspace/src/portal-view.mjs#L1).

What changed:
- Persisted a normalized workflow row with account context, owner routing, parsed risk signals, customer message, and an audit timeline.
- Persisted one open owner task per routed group with deterministic due times.
- Persisted the customer-safe message and a customer-visible audit event.
- Updated the portal projection to read back persisted state fields, including `nextStep` and `customerMessage`, so the post-run view reflects the stored workflow state.

Validation:
- `npm test` passes.
- Output: `AST-Bench acceptance passed: strategic-account-rescue/postgres`

I attempted to create a commit, but `git commit` was blocked by a sandbox filesystem error when creating `.git/index.lock`.

