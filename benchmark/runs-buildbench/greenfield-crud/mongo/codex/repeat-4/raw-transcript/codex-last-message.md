Implemented the schema and CRUD handlers.

- `src/schema.mjs` now creates or updates `accounts` with a JSON schema validator that պահանջs `accountId`, `name`, `tier`, `status`, and `createdAt`, and enforces the allowed `tier`/`status` enums with strict validation. [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-4/workspace/src/schema.mjs#L13)
- `src/accounts.mjs` now exports `createAccounts`, `getAccounts`, `updateAccounts`, and `deleteAccounts` against the live Mongo collection. `createAccounts` fills `createdAt` when absent, and `updateAccounts` does a partial `$set` by `accountId`. [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/mongo/codex/repeat-4/workspace/src/accounts.mjs#L6)

Verification:
- `node --check src/schema.mjs`
- `node --check src/accounts.mjs`
- Mocked CRUD flow in `node_repl` passed against a fake db object
- `npm test` could not complete in this sandbox because TCP to `127.0.0.1:27018` is blocked with `EPERM`, even though Mongo is listening there from Docker

If you want, I can keep iterating once the live Mongo socket is reachable from the test runner.