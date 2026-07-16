Implemented shipments support.

- Added validated `shipments` collection to `src/schema.mjs`.
- Added `createShipment`, `getShipment`, and `getShipmentsByOrder` in `src/shipments.mjs`.
- Corrected pre-existing schema syntax errors that prevented the app from loading.
- Verified with `npm test` — acceptance suite passes.