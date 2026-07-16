Implemented `riskScore` as an optional integer from 0–100.

- [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-3/workspace/src/schema.mjs:3) now enforces it in JSONB and migrates existing `accounts` tables idempotently.
- [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-3/workspace/src/accounts.mjs:3) validates it on create/update; reads continue returning the stored document including `riskScore`.
- No protected files or tests were changed.

Verified:

- `npm test` passed.
- A live database check confirmed the constraint is installed and rejects `riskScore: 101`.
- `git diff --check` passed.

