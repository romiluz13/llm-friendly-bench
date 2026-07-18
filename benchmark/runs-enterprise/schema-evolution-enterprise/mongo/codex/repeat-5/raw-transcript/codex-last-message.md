Implemented `preferredPaymentMethod` support across accounts and order summaries.

- Added optional enum validation in `src/schema.mjs`
- Preserved the field in account creation and updates
- Included it in `getOrderSummary`
- Ensured account creation satisfies the existing `createdAt` schema requirement

Verified with `npm test` — acceptance tests pass.