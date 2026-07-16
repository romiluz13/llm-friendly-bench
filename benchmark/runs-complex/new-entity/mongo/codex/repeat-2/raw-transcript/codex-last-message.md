Implemented shipments support:

- Added `shipments` collection schema and validation in [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-complex/new-entity/mongo/codex/repeat-2/workspace/src/schema.mjs).
- Added [shipments.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-complex/new-entity/mongo/codex/repeat-2/workspace/src/shipments.mjs) with `createShipment`, `getShipment`, and `getShipmentsByOrder`.
- Corrected the existing collection-call closing syntax in `schema.mjs`, which prevented the module from loading.

`npm test` passes, including live DB shipment CRUD and existing-entity regression coverage.