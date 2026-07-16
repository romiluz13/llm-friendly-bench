Implemented shipments support.

- Added `shipments` schema with order FK and status constraint.
- Added `src/shipments.mjs` with `createShipment`, `getShipment`, and `getShipmentsByOrder`.
- Verified with `npm test` — acceptance suite passes.