Implemented the JSONB-backed `riskScore` evolution:

- Added optional integer 0–100 schema validation with an existing-table migration in [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-3/workspace/src/schema.mjs:9).
- Added create/update validation in [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-3/workspace/src/accounts.mjs:3). Reads already return the JSONB document, including `riskScore`.

`node --check` and `git diff --check` passed. `npm test` cannot reach the required live PostgreSQL database in this sandbox: `connect EPERM 127.0.0.1:5433`, before any test assertions run. Re-run `npm test` where that local database connection is permitted to complete acceptance verification.

