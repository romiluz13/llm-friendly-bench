Implemented `src/workflow.mjs` to:
- read the live account document
- derive the five risk signals and routed owners from `RULES.md`
- persist `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`
- keep non-qualifying accounts on the monitoring path with no owner tasks

The change is in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/postgres-jsonb/codex/repeat-1/workspace/src/workflow.mjs#L29).

`npm test` still fails in this sandbox before the workflow runs because Node cannot open the benchmark Postgres port: `connect EPERM 127.0.0.1:5433`. I could not complete live-db verification from here.

