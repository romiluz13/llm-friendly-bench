Implemented in [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-5/workspace/src/schema.mjs#L13) and [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-5/workspace/src/accounts.mjs#L6).

What changed:
- `ensureSchema(db)` now creates `accounts` with a strict JSON schema validator for `accountId`, `name`, `tier`, `status`, and `createdAt`.
- `createAccounts` now defaults `createdAt` to `new Date()` when the caller omits it, writes to the live collection, and returns the inserted doc.
- `getAccounts`, `updateAccounts`, and `deleteAccounts` all operate directly on MongoDB.
- `updateAccounts` only patches the mutable fields and returns the updated document.

Validation:
- `node --input-type=module -e "import('./src/schema.mjs'); import('./src/accounts.mjs')"` passed.
- `npm test` could not complete in this sandbox because the live Mongo socket is blocked here: `MongoServerSelectionError: connect EPERM 127.0.0.1:27018`.

If you rerun this in an environment with access to `db-config.json`'s Mongo instance, the acceptance test should be the final check.