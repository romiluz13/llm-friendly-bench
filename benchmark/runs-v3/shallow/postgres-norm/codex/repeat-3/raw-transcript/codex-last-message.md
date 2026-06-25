Implemented the live read/derive/persist flow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-norm/codex/repeat-3/workspace/src/workflow.mjs#L4), [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-norm/codex/repeat-3/workspace/src/workflow.mjs#L37), and [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-norm/codex/repeat-3/workspace/src/workflow.mjs#L114). It now sets raw JSON parsers, derives signals and owner routing from `RULES.md`, and writes `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in one transaction.

`node -e "import('./src/workflow.mjs')"` passes.

`npm test` still fails in this sandbox before the workflow runs because the local Postgres socket is unreachable: `connect EPERM 127.0.0.1:5433`. I couldn’t complete an end-to-end green run here.

