Implemented the account payment-method schema evolution.

- Added optional enum validation for `preferredPaymentMethod` in `src/schema.mjs`.
- Ensured account updates apply the schema migration first.
- Included `preferredPaymentMethod` in `getOrderSummary`.

Verified: `npm test` passes.