Implemented shipments support:

- Added validated `shipments` collection in [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-complex/new-entity/mongo/codex/repeat-3/workspace/src/schema.mjs).
- Added [shipments.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-complex/new-entity/mongo/codex/repeat-3/workspace/src/shipments.mjs) with `createShipment`, `getShipment`, and `getShipmentsByOrder`.

Verified with `npm test`: all brownfield regression and live-database shipment acceptance checks pass.