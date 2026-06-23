Implemented in the source, not the fixture:

- [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/deep/codex/repeat-2/mongo/workspace/src/workflow.mjs#L3) now upserts the workflow state, owner tasks, customer-safe message, and customer-visible audit event, and it carries the account/contract/support/invoice/usage/shipment/regulatory context plus a preserved audit timeline.
- [src/portal-view.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/deep/codex/repeat-2/mongo/workspace/src/portal-view.mjs#L1) now reads the customer-visible status/history safely and tolerates missing collections.

`npm test` passes.

I did not create a git commit because the sandbox blocked writing `.git/index.lock`.

