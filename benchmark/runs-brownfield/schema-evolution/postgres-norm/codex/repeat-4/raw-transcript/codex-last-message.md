Implemented `riskScore` in the permitted source files:

- [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-4/workspace/src/schema.mjs:10): nullable `INTEGER` constrained to 0–100, plus an idempotent migration for existing tables.
- [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-4/workspace/src/accounts.mjs:4): create, get, and update now round-trip `riskScore`; omitted values remain nullable.

`git diff --check` and both `node --check` commands passed.

`npm test` remains unverified: this sandbox blocks the required live PostgreSQL connection with `EPERM 127.0.0.1:5433`. No fallback was added. Run `npm test` in a database-enabled terminal to complete acceptance verification.

