Implemented shipments support:

- Added `shipments` table with an orders foreign key and status constraint.
- Added `src/shipments.mjs` with `createShipment`, `getShipment`, and `getShipmentsByOrder`.
- Verified with `npm test` — acceptance suite passes.