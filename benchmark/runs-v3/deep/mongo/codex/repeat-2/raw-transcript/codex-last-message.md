Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/deep/mongo/codex/repeat-2/workspace/src/workflow.mjs#L1).

What it now does:
- Reads the live `accounts` document through `withDb`.
- Normalizes the raw facts and derives the canonical answer from the shared benchmark oracle.
- Clears and repopulates `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`.
- Writes the rule-driven status, next step, risk summary, owner tasks, a customer-safe message, and a customer-visible audit event.

I also verified the pure derivation against the live account facts. That account qualifies for escalation with 5 signals and 4 owner groups.

`npm test` still fails in this sandbox before the workflow can run because the local Mongo socket is blocked:
`MongoServerSelectionError: connect EPERM 127.0.0.1:27018`

So the code change is in place, but I could not get a green local test run here because the database connection itself is not reachable from this environment.