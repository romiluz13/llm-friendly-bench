Implemented the minimal `riskScore` evolution in:

- [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-3/workspace/src/schema.mjs:10): nullable `INTEGER` constrained to `0–100`, plus an idempotent migration for existing tables.
- [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-3/workspace/src/accounts.mjs:4): create, get, and update now handle `riskScore`.

No tests or DB configuration were modified. Both changed modules pass syntax checks.

`npm test` remains blocked before application code runs: the sandbox denies the real PostgreSQL connection with `connect EPERM 127.0.0.1:5433`. Run it in an environment permitted to reach that local database to confirm the acceptance suite.

