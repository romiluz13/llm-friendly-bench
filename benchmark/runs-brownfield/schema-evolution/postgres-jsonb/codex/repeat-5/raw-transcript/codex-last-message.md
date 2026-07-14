Added `riskScore` support in [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-5/workspace/src/schema.mjs) and [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-5/workspace/src/accounts.mjs):

- Optional JSONB field constrained to integer `0–100`, with an idempotent existing-table migration.
- Create/update validate `riskScore`; get continues returning the stored document unchanged.
- No changes to tests or `src/db.mjs`.

`git diff --check` and Node syntax checks pass. `npm test` is blocked before assertions by this sandbox’s denied connection to the required DB: `connect EPERM 127.0.0.1:5433`. Re-run `npm test` where that Postgres endpoint is accessible to complete live verification.

