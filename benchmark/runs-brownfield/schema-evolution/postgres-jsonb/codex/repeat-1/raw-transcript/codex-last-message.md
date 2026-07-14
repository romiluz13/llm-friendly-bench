Added `riskScore` support in the existing JSONB account doc path, with schema enforcement that works on both fresh and pre-existing `accounts` tables. See [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-1/workspace/src/schema.mjs#L12) and [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-1/workspace/src/accounts.mjs#L3).

- `src/schema.mjs`: added a `riskScore` CHECK constraint and a brownfield `ALTER TABLE` backfill so existing tables pick it up.
- `src/accounts.mjs`: added `assertRiskScore` and wired it into create/update so valid integer scores `0-100` persist and invalid values fail fast.

Verification:
- `node --input-type=module -e "import('./src/schema.mjs'); import('./src/accounts.mjs'); console.log('modules ok')"` passed.
- `npm test` is still blocked here by `connect EPERM 127.0.0.1:5433`, so I couldn’t complete the live-database acceptance run in this environment.

1. Make the benchmark Postgres service reachable on `127.0.0.1:5433` and rerun `npm test`.

