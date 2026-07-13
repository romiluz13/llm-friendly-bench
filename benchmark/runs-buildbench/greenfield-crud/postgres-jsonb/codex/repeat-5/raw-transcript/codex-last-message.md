Implemented the schema and CRUD handlers.

- [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-jsonb/codex/repeat-5/workspace/src/schema.mjs#L6) now exports `ensureSchema(db)` and creates `accounts(account_id TEXT PRIMARY KEY, doc JSONB NOT NULL)` plus a GIN index on `doc`.
- [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-buildbench/greenfield-crud/postgres-jsonb/codex/repeat-5/workspace/src/accounts.mjs#L62) now exports `createAccounts`, `getAccounts`, `updateAccounts`, and `deleteAccounts`. It stores the document in JSONB, validates `tier` and `status`, defaults `createdAt` on create, preserves partial-update semantics, and returns `null`/`false` for missing rows.
- I verified both edited files parse with `node --check`.

`npm test` could not complete in this sandbox because socket connections to the live Postgres endpoint are blocked at the OS level: `connect EPERM 127.0.0.1:5433` / `Operation not permitted`. I also confirmed the same denial with `nc` and a Python socket probe, so I could not finish live DB verification here.