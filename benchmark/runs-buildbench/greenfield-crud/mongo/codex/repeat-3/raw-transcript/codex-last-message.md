Implemented the accounts schema and CRUD in [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-3/workspace/src/schema.mjs#L3) and [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-3/workspace/src/accounts.mjs#L6).

- `ensureSchema(db)` now creates the `accounts` collection or updates it with the required JSON schema validator.
- `createAccounts`, `getAccounts`, `updateAccounts`, and `deleteAccounts` now operate on the live Mongo collection directly.
- `createAccounts` sets `createdAt` automatically, `updateAccounts` only applies mutable fields, and `deleteAccounts` removes by `accountId`.
- I also added `_id` to the validator so MongoDB accepts generated ObjectIds when `additionalProperties: false` is enabled. 

Verification:
- `node --input-type=module -e "await import('./src/schema.mjs'); await import('./src/accounts.mjs')"` passed.
- `npm test` could not complete here because the sandbox blocks MongoDB access to `127.0.0.1:27018` with `MongoServerSelectionError: connect EPERM`.

If you want, I can keep iterating once the benchmark environment can reach the live Mongo instance.