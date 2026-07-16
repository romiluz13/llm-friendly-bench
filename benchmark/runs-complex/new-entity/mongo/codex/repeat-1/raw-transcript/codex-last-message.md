Implemented shipments support.

- Added `shipments` collection schema with required fields and status validation.
- Added [shipments.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-complex/new-entity/mongo/codex/repeat-1/workspace/src/shipments.mjs) with create/get/query-by-order functions.
- Corrected existing schema syntax so collection setup executes.
- Verified: `npm test` passes, including live database checks.