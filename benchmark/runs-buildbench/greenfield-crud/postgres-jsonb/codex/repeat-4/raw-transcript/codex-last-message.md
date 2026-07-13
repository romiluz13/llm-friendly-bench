Implemented the `accounts` JSONB schema and CRUD in [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-jsonb/codex/repeat-4/workspace/src/schema.mjs#L7) and [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-jsonb/codex/repeat-4/workspace/src/accounts.mjs#L24).

- Schema now creates `accounts(account_id, doc)` in the configured live schema, adds a GIN index on `doc`, and enforces the required field contract with checks for string-typed `accountId`, `name`, `tier`, `status`, and `createdAt`, plus allowed `tier`/`status` values.
- CRUD now writes and reads the live table directly, preserves `createdAt` on update, keeps `accountId` aligned with `account_id`, and returns `null`/`true` in the expected delete/read cases.

Verification:
- `node -e "import('./src/schema.mjs')"` passed.
- `node -e "import('./src/accounts.mjs')"` passed.
- `npm test` could not complete in this sandbox because the localhost Postgres connection is blocked before SQL runs: `Error: connect EPERM 127.0.0.1:5433`.