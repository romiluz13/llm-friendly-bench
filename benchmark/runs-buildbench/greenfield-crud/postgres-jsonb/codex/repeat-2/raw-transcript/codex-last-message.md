Implemented the schema and CRUD layer in `src/`.

- [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-jsonb/codex/repeat-2/workspace/src/schema.mjs#L3) now creates `accounts` with `account_id` as the primary key, a `doc` JSONB column, CHECK constraints for the required fields and enum values, and a GIN index on `doc`.
- [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-jsonb/codex/repeat-2/workspace/src/accounts.mjs#L3) now implements create, read, update, and delete against the live schema. Create stamps `createdAt` when absent, and update preserves `accountId` and `createdAt` while patching only mutable fields.

Verification:
- `node --input-type=module` loading of the edited modules passed.
- `npm test` did not reach the CRUD assertions because the sandbox rejected the live DB connection: `connect EPERM 127.0.0.1:5433`.

Next step: rerun `npm test` in an environment that can reach the benchmark Postgres service.

