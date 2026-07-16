Implemented shipments support.

- Added `shipments` schema with order relationship, status constraint, and order index.
- Added `src/shipments.mjs` with `createShipment`, `getShipment`, and `getShipmentsByOrder`.
- `npm test` passes, including live database verification.