Implemented the CRUD and schema in [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-5/workspace/src/schema.mjs#L3) and [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-5/workspace/src/accounts.mjs#L1).

- `ensureSchema(db)` now creates or updates the `accounts` collection with a JSON schema validator for `accountId`, `name`, `tier`, `status`, and `createdAt`.
- It also adds a unique index on `accountId`.
- `createAccounts` writes to the live collection and fills in `createdAt` when omitted.
- `getAccounts`, `updateAccounts`, and `deleteAccounts` all operate by `accountId` against Mongo directly.
- `updateAccounts` only patches the mutable fields `name`, `tier`, and `status`.

Verification is blocked in this sandbox: `npm test` fails before the app logic runs because the process cannot connect to the live Mongo endpoint at `127.0.0.1:27018` (`MongoServerSelectionError: connect EPERM`). I did confirm the edited modules load cleanly and a local mock smoke test passed.