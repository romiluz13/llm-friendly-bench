Implemented shipments support.

- Updated `src/schema.mjs` with `shipments`, linked to `orders` by FK.
- Added `src/shipments.mjs` with `createShipment`, `getShipment`, and `getShipmentsByOrder`.
- Verified live database acceptance: `npm test` passes.