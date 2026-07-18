Implemented the account payment preference end-to-end.

- Added optional validated `preferred_payment_method` schema field.
- Added create/read/update handling in `accounts.mjs`.
- Included `preferredPaymentMethod` in `getOrderSummary`.
- Applied small live-schema compatibility migrations needed by the existing acceptance fixtures.

Verified: `npm test` passes.