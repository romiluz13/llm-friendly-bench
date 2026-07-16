Implemented `riskScore` across the existing accounts schema and CRUD.

- [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-2/workspace/src/schema.mjs:10) adds nullable `risk_score INTEGER CHECK (… BETWEEN 0 AND 100)` plus a safe existing-table migration.
- [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-2/workspace/src/accounts.mjs:4) maps, creates, reads, and updates `riskScore`.

Verified:

```text
npm test
Build-Bench brownfield acceptance passed: postgres-norm/schema-evolution
```

`git diff --check` also passed.