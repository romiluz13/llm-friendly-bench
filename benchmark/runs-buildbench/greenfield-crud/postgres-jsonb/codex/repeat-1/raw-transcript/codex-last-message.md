Implemented the `postgres-jsonb` accounts lane.

- [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-jsonb/codex/repeat-1/workspace/src/schema.mjs)
  - Creates `accounts` with `account_id TEXT PRIMARY KEY` and `doc JSONB NOT NULL`.
  - Adds checks for required fields, allowed `tier`/`status` values, `accountId` consistency, and parseable `createdAt`.
  - Adds a GIN index on `doc`.

- [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-jsonb/codex/repeat-1/workspace/src/accounts.mjs)
  - Implements `createAccounts`, `getAccounts`, `updateAccounts`, `deleteAccounts`.
  - Defaults `createdAt` on create.
  - Preserves existing fields on partial update.
  - Returns `null`/`false` when rows are missing.

Verification:
- Module import succeeded.
- A mock-client CRUD smoke test passed.
- `npm test` still cannot reach the live DB from this sandbox: `connect EPERM 127.0.0.1:5433`. So I could not complete the real acceptance run here.