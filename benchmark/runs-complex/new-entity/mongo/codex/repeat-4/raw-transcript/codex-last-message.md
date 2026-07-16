Implemented shipments support:

- Added `shipments` collection validation in `src/schema.mjs`.
- Added `src/shipments.mjs` with `createShipment`, `getShipment`, and `getShipmentsByOrder`.
- Fixed pre-existing schema validator syntax so the module can load.

Verified: `npm test` passes, including live DB shipment CRUD and existing entity regression coverage.