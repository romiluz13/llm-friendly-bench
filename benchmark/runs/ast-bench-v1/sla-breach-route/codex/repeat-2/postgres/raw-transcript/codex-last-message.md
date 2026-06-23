Implemented the SLA breach route in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/sla-breach-route/codex/repeat-2/postgres/workspace/src/workflow.mjs#L3), wiring it to the normalized fixture tables and persisting the workflow state, owner tasks, customer-safe message, and customer-visible audit event. The portal projection now resolves to the required escalated status and owner chain.

`npm test` passes.

I couldn’t create a git commit in this workspace because Git object/index writes are blocked here, so the change is left as a single modified source file.

