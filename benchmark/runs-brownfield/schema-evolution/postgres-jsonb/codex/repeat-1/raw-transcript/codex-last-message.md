Implemented `riskScore` evolution.

- [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-1/workspace/src/schema.mjs:11) adds an idempotent optional JSONB integer `0–100` constraint.
- [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-1/workspace/src/accounts.mjs:3) validates create/update inputs; existing reads already return the JSONB field.

Verified against the live database: invalid scores are rejected by both schema and update API.

`npm test` exited 0: `Build-Bench brownfield acceptance passed: postgres-jsonb/schema-evolution`.