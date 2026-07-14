Implemented the schema evolution in [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-4/workspace/src/schema.mjs:3):

- `riskScore` is optional and validated as BSON `int`, 0–100.
- Existing collections are upgraded with `collMod` only when their rule is missing or mismatched.
- Existing generic create/get/update already persists and returns `riskScore`; no redundant CRUD rewrite was needed.

`node --check` and `git diff --check` passed.

`npm test` could not complete because this sandbox denies the required live MongoDB connection: `connect EPERM 127.0.0.1:27018` (exit 1). No fallback was added.

