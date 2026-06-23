Implemented the invoice-dispute workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/invoice-dispute-workflow/codex/repeat-2/mongo/workspace/src/workflow.mjs).

What changed:
- Builds the workflow from the request, account, and activity timeline.
- Persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`.
- Sets the exact customer-facing status required by the acceptance contract.
- Keeps the MongoDB document model native with a bundled evidence snapshot and finance owner routing.

Verification:
- `npm test` passed.

I could not create a git commit in this sandbox because `git commit` failed with `.git/index.lock: Operation not permitted`. The source change is in place and the test is green.

