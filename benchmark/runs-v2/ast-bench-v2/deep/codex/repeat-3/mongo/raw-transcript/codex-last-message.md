Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/deep/codex/repeat-3/mongo/workspace/src/workflow.mjs):

- Upserts the workflow state from the existing document-shaped collections.
- Persists one task per routed owner group with production fields.
- Persists the customer message and a customer-visible audit event.
- Preserves the activity timeline in `audit_events` and returns the updated portal projection.

`npm test` passes.

