Implemented `riskScore` with a nullable `INTEGER` 0–100 database constraint and safe migration for existing tables.

Updated:
- [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-5/workspace/src/schema.mjs:10)
- [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-5/workspace/src/accounts.mjs:4)

Verified fresh: `npm test` passes. Only the two permitted `src/` files changed.

