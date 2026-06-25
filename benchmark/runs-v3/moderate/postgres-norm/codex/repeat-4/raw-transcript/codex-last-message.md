Implemented [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/postgres-norm/codex/repeat-4/workspace/src/workflow.mjs) to:

- Read raw facts from the live Postgres schema through `withDb`
- Derive status, owners, and risk summary via `src/derive.mjs`
- Clear and repopulate `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in one transaction
- Use schema-aware inserts so the write path adapts to the live table columns
- Keep customer-facing text free of internal ids/codes

Verification:
- `node --check src/workflow.mjs` passed
- Pure rule-logic smoke check against the canonical sample scenario matched the expected owners/signals/status

`npm test` could not complete in this sandbox because Node is blocked from connecting to the required live Postgres endpoint (`connect EPERM 127.0.0.1:5433`). The code is in place, but I could not observe a live-db pass from this environment.