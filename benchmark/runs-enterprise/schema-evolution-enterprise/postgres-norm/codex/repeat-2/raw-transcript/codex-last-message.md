Implemented `preferredPaymentMethod` end-to-end:

- Added nullable, constrained `accounts.preferred_payment_method`
- Added create/update/retrieval support in `accounts.mjs`
- Included it in `getOrderSummary`
- Added required live-schema compatibility migrations

Verified: `npm test` passes.