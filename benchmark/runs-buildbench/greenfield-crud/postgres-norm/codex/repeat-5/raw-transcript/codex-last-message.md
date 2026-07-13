Implemented the schema and CRUD handlers.

- [src/schema.mjs:12](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-5/workspace/src/schema.mjs#L12) now creates `accounts` with `account_id` as the primary key, required `name`, `tier` and `status` CHECK constraints, and `created_at DATE NOT NULL DEFAULT CURRENT_DATE`.
- [src/accounts.mjs:6](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-5/workspace/src/accounts.mjs#L6) and [src/accounts.mjs:25](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-5/workspace/src/accounts.mjs#L25) map rows to camelCase documents and implement create with a server-side `createdAt` default.
- [src/accounts.mjs:39](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-5/workspace/src/accounts.mjs#L39), [src/accounts.mjs:53](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-5/workspace/src/accounts.mjs#L53), and [src/accounts.mjs:78](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-5/workspace/src/accounts.mjs#L78) implement read, partial update, and delete directly against Postgres.

Verification:
- `node --check src/schema.mjs` passed.
- `node --check src/accounts.mjs` passed.
- Module imports for both files passed.
- `npm test` could not complete in this sandbox because the live DB connection is blocked (`EPERM` connecting to `127.0.0.1:5433`).

If you run this in an environment that can reach the benchmark Postgres instance, `npm test` is the remaining gate.