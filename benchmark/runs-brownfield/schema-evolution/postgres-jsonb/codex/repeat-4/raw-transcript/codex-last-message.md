Implemented the `riskScore` evolution in [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-4/workspace/src/schema.mjs) and [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-4/workspace/src/accounts.mjs).

- JSONB constraint enforces optional integer values from 0–100 and safely migrates existing tables.
- Create/update validate `riskScore`; get continues returning the document unchanged.
- Static syntax and diff checks passed.

`npm test` remains blocked before tests execute: the sandbox denies the required local PostgreSQL connection (`connect EPERM 127.0.0.1:5433`). Live-database acceptance is therefore unverified here.

