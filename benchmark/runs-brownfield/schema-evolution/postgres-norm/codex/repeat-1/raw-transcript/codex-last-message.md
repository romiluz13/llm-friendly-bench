Implemented the `riskScore` schema and CRUD changes in [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-1/workspace/src/schema.mjs:10) and [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-1/workspace/src/accounts.mjs:4).

- Nullable integer `risk_score`, constrained to `0–100`, with an idempotent migration for existing tables.
- Create, get, and update support `riskScore`.
- Legacy accounts retain their previous returned object shape when no score exists.
- Only the two allowed `src/` files changed.

`git diff --check` and both source syntax checks passed. `npm test` remains blocked by the sandbox before any test code runs:

```text
Error: connect EPERM 127.0.0.1:5433
```

So live-database acceptance could not be confirmed in this environment.

