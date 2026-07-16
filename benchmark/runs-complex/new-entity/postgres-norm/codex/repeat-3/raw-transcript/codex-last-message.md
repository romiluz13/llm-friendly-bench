Implemented shipments support.

- Added `shipments` table with order FK and status constraint in `src/schema.mjs`.
- Added `createShipment`, `getShipment`, and `getShipmentsByOrder` in `src/shipments.mjs`.
- Verified with `npm test` — acceptance suite passes.