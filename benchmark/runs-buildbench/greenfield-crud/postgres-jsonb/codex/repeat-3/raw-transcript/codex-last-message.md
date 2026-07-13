Implemented the accounts resource against the live JSONB table in:

- [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-jsonb/codex/repeat-3/workspace/src/schema.mjs): creates `accounts(account_id text primary key, doc jsonb not null)`, adds JSONB field/value checks for the required fields and enums, and creates a GIN index on `doc`.
- [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-jsonb/codex/repeat-3/workspace/src/accounts.mjs): implements create/read/update/delete, auto-fills `createdAt` on create, preserves it on partial updates, and keeps `accountId` aligned with the row key.

Verification:
- `node --input-type=module` parse check passed.
- `npm test` is blocked in this sandbox before reaching Postgres with `connect EPERM 127.0.0.1:5433`, so I could not complete live-database verification here.

