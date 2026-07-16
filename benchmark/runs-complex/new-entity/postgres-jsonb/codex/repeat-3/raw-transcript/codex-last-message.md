Implemented shipments support.

- Added `shipments` schema with order foreign key, valid status constraint, and order index.
- Added `createShipment`, `getShipment`, and `getShipmentsByOrder` in [shipments.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-complex/new-entity/postgres-jsonb/codex/repeat-3/workspace/src/shipments.mjs).
- Verified with `npm test` — acceptance and regression tests pass.