Implemented the schema and CRUD in [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-2/workspace/src/schema.mjs:13) and [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-2/workspace/src/accounts.mjs:10).

- `ensureSchema(db)` now creates or updates `accounts` with a JSON-schema validator for `accountId`, `name`, `tier`, `status`, and `createdAt`, and adds a unique `accountId` index.
- `createAccounts`, `getAccounts`, `updateAccounts`, and `deleteAccounts` now hit the live Mongo collection directly. Create stamps `createdAt` when omitted, update patches only allowed fields, and delete returns a boolean.

Verification:
- Local stub flow passed.
- `npm test` could not complete here because the sandbox blocks the Mongo connection to `127.0.0.1:27018` (`MongoServerSelectionError: connect EPERM`).

Next step:
1. Re-run `npm test` in an environment that can reach the benchmark MongoDB.

