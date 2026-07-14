Added `riskScore` support in [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-5/workspace/src/schema.mjs:10) and [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-5/workspace/src/accounts.mjs:4):

- Nullable `risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100)`.
- Idempotent migration for the existing live table.
- Create, get mapping, and partial update support.

`node --check`, `git diff --check`, and a local query-contract CRUD check passed.

`npm test` is still blocked before any test assertion: this sandbox denies its required Postgres connection with `connect EPERM 127.0.0.1:5433`. I cannot claim the live acceptance suite passes until it runs in an environment allowed to connect to that database.