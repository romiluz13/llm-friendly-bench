**Implemented**
- `src/schema.mjs` now creates or `collMod`s the live `accounts` collection with a strict JSON-schema validator for `accountId`, `name`, `tier`, `status`, and `createdAt`. The validator starts at [this line](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-1/workspace/src/schema.mjs#L5), and the idempotent bootstrap logic starts at [this line](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-1/workspace/src/schema.mjs#L35).
- `src/accounts.mjs` now does live CRUD against MongoDB, defaults `createdAt` on create, updates by `accountId`, and deletes by `accountId`. The helper/build logic starts at [this line](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-1/workspace/src/accounts.mjs#L8), and the CRUD exports start at [this line](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-1/workspace/src/accounts.mjs#L31).

**Verification**
- `node --input-type=module` import check passed for the edited modules.
- `npm test` did not complete here because the sandbox cannot reach the configured MongoDB endpoint at `127.0.0.1:27018`; the driver fails with `MongoServerSelectionError: connect EPERM`.

If you can run this in an environment with access to the configured MongoDB instance, I can re-run `npm test` and confirm the live-db path end to end.