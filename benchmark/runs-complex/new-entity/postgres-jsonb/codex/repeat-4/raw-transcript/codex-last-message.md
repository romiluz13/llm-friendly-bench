Implemented shipments support.

- Updated `src/schema.mjs` with `shipments`, order FK, status validation, and order index.
- Added `src/shipments.mjs` with `createShipment`, `getShipment`, and `getShipmentsByOrder`.
- `npm test` passes, including live database verification and regressions.