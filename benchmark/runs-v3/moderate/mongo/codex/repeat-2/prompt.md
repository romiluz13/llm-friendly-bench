You are running AST-Bench V3, a live-database coding benchmark.

Your job: implement `src/workflow.mjs` so it connects to the live mongo database
described in `db-config.json`, reads the account's raw facts, DERIVES the rescue
workflow exactly per `RULES.md`, and PERSISTS the result back to the live database
(workflow_state, owner_tasks, customer_messages, audit_events).

Then run `npm test` until it passes. The test connects to the live database and
checks your persisted state against the rules.

Rules:
- The answer is NOT in the data. Derive status, owners, risk signals from raw facts per RULES.md.
- Connect to the real database (see db-config.json + src/db.mjs). Do not use a flat file as the database.
- Edit ONLY src/workflow.mjs. Do NOT modify src/db.mjs, tests/, db-config.json, or the seeded data.
  src/db.mjs already connects to the live database — import withDb from it as-is.
- Do NOT add any file-based or in-memory fallback. If the database connection fails, let it fail.
- Make the smallest correct production-style change.