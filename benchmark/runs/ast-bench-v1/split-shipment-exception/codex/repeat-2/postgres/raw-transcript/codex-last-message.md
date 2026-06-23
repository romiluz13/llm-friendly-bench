Implemented the split-shipment exception workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/split-shipment-exception/codex/repeat-2/postgres/workspace/src/workflow.mjs#L3). It now reconstructs the normalized Postgres tables, persists one workflow state row plus owner tasks, customer message, and customer-visible audit event, and carries the account tier, support plan, replacement plan, and audit timeline through the state.

`npm test` passes.

