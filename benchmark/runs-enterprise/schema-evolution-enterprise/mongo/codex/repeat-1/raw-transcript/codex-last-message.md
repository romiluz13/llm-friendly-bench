Implemented preferred payment method support.

- Added optional enum validation in `src/schema.mjs`
- Added create/update handling and validation in `src/accounts.mjs`
- Included `preferredPaymentMethod` in `getOrderSummary`
- Verified with `npm test` — passing.