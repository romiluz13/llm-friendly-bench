Implemented the `riskScore` contract:

- [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-2/workspace/src/schema.mjs:11) adds an optional JSONB integer constraint (0–100), with an idempotent, concurrency-safe migration.
- [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-2/workspace/src/accounts.mjs:3) validates `riskScore` on create/update; reads retain it from the JSONB document.

`node --check` and `git diff --check` pass. `npm test` is blocked before tests execute because this sandbox denies the required live DB connection: `connect EPERM 127.0.0.1:5433`. No tests or protected files were changed.

