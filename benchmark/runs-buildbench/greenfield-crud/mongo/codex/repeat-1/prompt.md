You are running Build-Bench, a live-database coding benchmark.

Your job: design the schema for the **accounts** resource and implement CRUD
(create, read, update, delete) against the live mongo database described in
`db-config.json`.

Steps:
1. Read `RULES.md` for the field definitions and constraints.
2. Implement `src/schema.mjs` — export `ensureSchema(db)` that creates the collection
   with a validator matching the fields.
3. Implement `src/accounts.mjs` — export `createAccounts`, `getAccounts`,
   `updateAccounts`, `deleteAccounts`. Each takes the db handle from `src/db.mjs`.
4. Run `npm test` until it passes. The test calls your handlers AND queries the
   live database directly to verify the data is really there.

Rules:
- Connect to the real database (see db-config.json + src/db.mjs). Do NOT use a
  flat file or in-memory store as the database.
- Edit files under `src/` EXCEPT `src/db.mjs` (protected — it already connects
  to the live database). Do NOT modify anything under `tests/`.
- Do NOT add any file-based or in-memory fallback. If the database connection
  fails, let it fail.
- Make the smallest correct production-style change.