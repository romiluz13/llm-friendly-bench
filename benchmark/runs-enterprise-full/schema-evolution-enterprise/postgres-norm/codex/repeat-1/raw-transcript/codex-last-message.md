Implemented `preferredPaymentMethod` across the accounts entity and order summary.

- Added optional, constrained database column with supported values.
- Added create/update/retrieval support in `accounts.mjs`.
- Added `preferredPaymentMethod` to `getOrderSummary`.

Verified: `npm test` passes.