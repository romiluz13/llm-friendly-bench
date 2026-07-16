Implemented `riskScore` across the existing live schema and CRUD:

- [`src/schema.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-3/workspace/src/schema.mjs:10) adds nullable `INTEGER` `risk_score` with a 0–100 check and migrates existing tables.
- [`src/accounts.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-3/workspace/src/accounts.mjs:4) maps, creates, reads, and updates `riskScore`.

Verified live schema: nullable integer with the required check constraint.

`npm test` passes: `Build-Bench brownfield acceptance passed: postgres-norm/schema-evolution`.