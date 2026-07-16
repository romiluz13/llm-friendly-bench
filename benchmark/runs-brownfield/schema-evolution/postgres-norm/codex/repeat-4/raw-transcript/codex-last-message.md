Implemented the optional `riskScore` field.

- [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-4/workspace/src/schema.mjs:10) adds nullable `risk_score INTEGER CHECK (0–100)` and migrates existing tables idempotently.
- [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-4/workspace/src/accounts.mjs:4) maps, creates, reads, and updates `riskScore`.

Verification passed:

```text
npm test
Build-Bench brownfield acceptance passed: postgres-norm/schema-evolution
```

A live database query also confirmed `risk_score` is nullable `integer` with the 0–100 constraint.