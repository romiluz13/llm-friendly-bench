Implemented `src/workflow.mjs` to read the live `accounts` document, derive signals/owners from the shared rule helper, and clear/repopulate the four output collections with the rule-compliant status, next step, risk summary, owner tasks, customer message, and audit event. See [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/mongo/codex/repeat-3/workspace/src/workflow.mjs#L28) and [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/mongo/codex/repeat-3/workspace/src/workflow.mjs#L70).

Validation:
- `node --check src/workflow.mjs` passed.
- `npm test` could not complete here because the sandbox blocks Node from connecting to `127.0.0.1:27018` (`MongoServerSelectionError: connect EPERM`).

