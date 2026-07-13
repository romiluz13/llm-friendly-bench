Implemented the accounts schema and CRUD in:

- [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-4/workspace/src/schema.mjs)
- [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-4/workspace/src/accounts.mjs)

What changed:
- `ensureSchema(db)` now creates `accounts` with:
  - `account_id` as the primary key
  - `name` as required text
  - `tier` with the required CHECK constraint
  - `status` with the required CHECK constraint
  - `created_at` as required `date` with a `CURRENT_DATE` default
- CRUD handlers now:
  - insert, read, update, and delete against Postgres
  - use parameterized SQL
  - return camelCase objects for the resource shape
  - preserve `createdAt` from the DB row

Verification:
- `node --check` passed for the edited files.
- `npm test` could not complete here because the sandbox cannot connect to the live DB port: `Error: connect EPERM 127.0.0.1:5433`.

If you want, I can keep going once the DB is reachable in this environment.