Implemented the live MongoDB CRUD slice and schema validator.

- Schema creation and validator live in [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-1/workspace/src/schema.mjs#L13) and [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-1/workspace/src/schema.mjs#L27).
- CRUD handlers live in [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-1/workspace/src/accounts.mjs#L23), [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-1/workspace/src/accounts.mjs#L40), [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-1/workspace/src/accounts.mjs#L45), and [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-1/workspace/src/accounts.mjs#L66).
- `createAccounts` stamps `createdAt` when missing, `getAccounts` reads by `accountId`, `updateAccounts` applies partial updates, and `deleteAccounts` deletes by `accountId`.
- I verified both edited files parse cleanly with `node --check`.
- I could not complete `npm test` in this sandbox because the Node runtime cannot reach the live MongoDB socket here: `MongoServerSelectionError: connect EPERM 127.0.0.1:27018`.

Next step: rerun `npm test` in an environment that can reach `127.0.0.1:27018`.

