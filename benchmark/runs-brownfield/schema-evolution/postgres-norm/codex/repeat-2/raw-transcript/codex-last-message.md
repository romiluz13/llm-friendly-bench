Implemented the minimal `riskScore` schema and CRUD evolution.

- [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-2/workspace/src/schema.mjs:5) adds nullable `risk_score INTEGER CHECK (0–100)` plus an idempotent migration for existing tables.
- [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-2/workspace/src/accounts.mjs:3) persists, returns, and selectively updates `riskScore`. Existing calls without it remain valid.

Verification:

```text
$ npm test
exit=1
Error: connect EPERM 127.0.0.1:5433
```

The sandbox blocks the required live PostgreSQL connection before acceptance tests run, so live verification remains unconfirmed. Source syntax checks and `git diff --check` pass; only the two permitted `src/` files changed.

