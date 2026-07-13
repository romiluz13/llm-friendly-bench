Implemented the `accounts` schema and live CRUD handlers.

- [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-3/workspace/src/schema.mjs#L12) now creates `accounts` with `account_id`, `name`, `tier`, `status`, and `created_at`, including the tier/status `CHECK` constraints and a `CURRENT_DATE` default for `created_at`.
- [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-norm/codex/repeat-3/workspace/src/accounts.mjs#L6) now exports `createAccounts`, `getAccounts`, `updateAccounts`, and `deleteAccounts`, maps Postgres rows to camelCase, and supports partial updates.
- `npm test` could not complete in this sandbox because the process cannot open a TCP connection to the local Postgres port `127.0.0.1:5433` (`EPERM`). I did verify the modules import cleanly.

If you can run this in an environment with loopback DB access, the next step is to rerun `npm test`.