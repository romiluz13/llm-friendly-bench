Implemented `riskScore` safely.

- Added optional JSONB constraint for integer `0–100`, including migration for existing tables: [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-2/workspace/src/schema.mjs:3)
- Added create/update validation; get continues returning the stored JSONB document: [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-2/workspace/src/accounts.mjs:3)
- Kept changes limited to `src/`.

Verified fresh against the live database:

- `npm test` passed.
- Invalid scores are rejected.
- Existing-table migration preserves legacy rows while constraining new writes, including concurrent migration checks.

