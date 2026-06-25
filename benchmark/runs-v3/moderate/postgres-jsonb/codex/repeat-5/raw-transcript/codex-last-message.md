Implemented [`src/workflow.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/moderate/postgres-jsonb/codex/repeat-5/workspace/src/workflow.mjs) to:

- read the account’s raw JSONB facts through `withDb`
- derive status, signals, owner routing, risk summary, and next step from `src/derive.mjs`
- clear and repopulate `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events` in one transaction
- persist a customer-safe message and customer-visible audit event
- keep the owner-task order and escalation wording aligned with `RULES.md`

`node --check src/workflow.mjs` and a module import both pass.

`npm test` still fails in this sandbox before the workflow runs because the environment blocks TCP to `127.0.0.1:5433` with `EPERM`, so I could not complete live database verification here.

