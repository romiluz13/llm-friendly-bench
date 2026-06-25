Implemented `src/workflow.mjs` to read the live account doc, derive the rescue workflow with the canonical rules helper, and persist the result in one transaction. It now clears stale output rows first, writes `workflow_state`, one task per derived owner, a customer-safe message, and a customer-visible audit event. See [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/postgres-jsonb/codex/repeat-4/workspace/src/workflow.mjs#L10) and [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/postgres-jsonb/codex/repeat-4/workspace/src/workflow.mjs#L34).

Validation:
- `node --check src/workflow.mjs` passed.
- `node --input-type=module -e "import('./src/workflow.mjs')"` passed.
- `npm test` could not complete here because the sandbox blocks the live Postgres socket: `connect EPERM 127.0.0.1:5433`.

