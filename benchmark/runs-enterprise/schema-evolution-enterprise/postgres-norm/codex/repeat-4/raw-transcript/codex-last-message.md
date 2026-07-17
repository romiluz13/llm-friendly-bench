Implemented preferred payment methods for accounts and exposed them in order summaries.

- Added optional `preferred_payment_method` with enum validation.
- Added create/update/retrieval support in `accounts.mjs`.
- Added `preferredPaymentMethod` to `getOrderSummary`.
- Preserved compatibility with the enterprise schema’s required defaults.

Verified: `npm test` passes.