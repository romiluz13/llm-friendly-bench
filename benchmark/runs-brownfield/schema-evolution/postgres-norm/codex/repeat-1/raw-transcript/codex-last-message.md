Implemented `riskScore` end to end.

- [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-1/workspace/src/schema.mjs#L3-L18) now includes `risk_score INTEGER` with a `0-100` check, and it also evolves existing tables with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-norm/codex/repeat-1/workspace/src/accounts.mjs#L3-L34) now maps `risk_score` to `riskScore`, inserts it on create, and updates it when provided.
- Accounts created without `riskScore` still return the old shape, because the property is only added when the DB value is non-null.

Verification:
- `npm test` could not complete in this sandbox because the live DB connection was blocked: `connect EPERM 127.0.0.1:5433`.
- I did run local smoke checks with stubbed clients for create/update/get mapping and the regression shape; those passed.

If you want, I can retry the full test once the local Postgres endpoint is reachable from the workspace.