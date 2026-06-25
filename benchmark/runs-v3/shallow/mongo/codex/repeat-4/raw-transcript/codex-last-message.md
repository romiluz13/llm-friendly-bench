Implemented `src/workflow.mjs` so it now:
- reads the live account from Mongo,
- derives qualifying status, risk summary, and owner routing from `src/derive.mjs`,
- persists one `workflow_state`, one customer-safe message, one customer-visible audit event, and one owner task per derived owner group,
- clears and repopulates those benchmark collections deterministically on reruns.

The derived live-fact result matches the rules: qualifying `true`, owners `Legal / Finance / Customer Success / Support`, signals `Regulatory hold / Overdue invoice / Delayed shipment / Escalated support / Usage decline`.

`npm test` still cannot complete in this sandbox because the local Node Mongo client is blocked on the loopback socket: `MongoServerSelectionError: connect EPERM 127.0.0.1:27018`. The workflow code itself is in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-v3/shallow/mongo/codex/repeat-4/workspace/src/workflow.mjs#L8).

