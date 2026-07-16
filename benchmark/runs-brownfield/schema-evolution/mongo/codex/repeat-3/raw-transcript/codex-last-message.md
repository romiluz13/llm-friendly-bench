Implemented in [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-3/workspace/src/schema.mjs:14):

- Optional `riskScore` BSON integer, 0–100.
- `collMod` updates the existing live collection’s validator.
- Existing generic CRUD already carries `riskScore` through create/get/update, so no redundant `accounts.mjs` change was needed.

Verified:

- `npm test` — passed.
- Live validator confirms `riskScore: int 0–100`.
- Boundary probe accepted 0/100 and rejected -1/101/12.5.

