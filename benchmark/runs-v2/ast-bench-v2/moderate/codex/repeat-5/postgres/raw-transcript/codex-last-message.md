Implemented in [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/moderate/codex/repeat-5/postgres/workspace/src/workflow.mjs#L14) and [`src/portal-view.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/moderate/codex/repeat-5/postgres/workspace/src/portal-view.mjs#L1).

- `applyBenchmarkTask` now reconstructs the native Postgres context, persists one workflow state row, all routed owner tasks, the customer-safe portal message, and a full audit timeline with a customer-visible escalation event.
- `buildPortalView` now renders owner routing deterministically from the persisted task rows and has a safe fallback when no request row is present.

Validation:
- `npm test` passed.

Commit note:
- I tried to commit the change, but this workspace blocked creation of `.git/index.lock` with `Operation not permitted`, so the verified diff remains in the working tree.

