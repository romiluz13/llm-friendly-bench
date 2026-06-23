Implemented in [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v2/ast-bench-v2/deep/codex/repeat-4/mongo/workspace/src/workflow.mjs#L3).

- Replaced the stub with deterministic, document-native workflow writes.
- It now upserts workflow state, owner tasks, customer message, and a customer-visible audit event.
- The persisted state carries the account tier, contract, support, invoice, usage, shipment, regulatory, and Legal-review context, plus the audit timeline.
- The portal projection still reads from the same native collections and now returns the expected customer-facing status.

Validation:
- `npm test` passes.

I couldn’t create a git commit here because the sandbox blocked `.git/index.lock` creation.

