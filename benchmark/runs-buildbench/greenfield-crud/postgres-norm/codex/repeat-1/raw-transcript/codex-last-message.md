Implemented the accounts schema and live-Postgres CRUD.

- [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-1/workspace/src/schema.mjs#L12) now creates `accounts` with:
  - `account_id` primary key
  - required `name`
  - required `tier` with the allowed values
  - required `status` with the allowed values
  - required `created_at` `DATE` with `CURRENT_DATE` default
- [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-1/workspace/src/accounts.mjs#L6) now implements:
  - `createAccounts`
  - `getAccounts`
  - `updateAccounts`
  - `deleteAccounts`
  - direct SQL against the provided pg client
  - camelCase return objects
  - partial updates
  - optional `createdAt` on create/update

Verification:
- Local stub validation of the SQL paths passed.
- `npm test` could not complete here because the sandbox blocks the live DB connection: `connect EPERM 127.0.0.1:5433`.

If you can run the same workspace with access to the Postgres port, the benchmark test should exercise the live database end-to-end.