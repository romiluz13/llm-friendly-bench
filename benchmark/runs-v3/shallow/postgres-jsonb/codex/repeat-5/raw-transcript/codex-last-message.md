Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-jsonb/codex/repeat-5/workspace/src/workflow.mjs#L1). The key pieces are:
- rule derivation and owner routing at [line 32](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-jsonb/codex/repeat-5/workspace/src/workflow.mjs#L32)
- live JSONB fact read plus transactionally clearing and repopulating `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` at [line 127](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/postgres-jsonb/codex/repeat-5/workspace/src/workflow.mjs#L127)

I verified the module imports cleanly. `npm test` could not complete in this sandbox because the live Postgres connection to `127.0.0.1:5433` is blocked with `EPERM`, so I could not observe the live-database acceptance pass from here.

