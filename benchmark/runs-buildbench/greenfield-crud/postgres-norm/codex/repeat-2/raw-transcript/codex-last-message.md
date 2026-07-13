Implemented the `accounts` schema and CRUD.

- [`src/schema.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-2/workspace/src/schema.mjs:12) now creates `accounts` with `account_id` as the primary key, required `name`, `tier`/`status` `CHECK` constraints, and `created_at DATE NOT NULL DEFAULT CURRENT_DATE`.
- [`src/accounts.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-2/workspace/src/accounts.mjs:6) now does live SQL CRUD against Postgres, maps snake_case rows to camelCase documents, and defaults `createdAt` on create when it is omitted.
- Verification: `node --check src/schema.mjs` and `node --check src/accounts.mjs` passed. `npm test` could not complete in this sandbox because TCP to the live DB is blocked: `connect EPERM 127.0.0.1:5433`.

