Implemented the account payment preference end to end.

- Added optional enum-backed `preferred_payment_method` to `accounts`.
- Added create, update, and retrieval support in `src/accounts.mjs`.
- Included `preferredPaymentMethod` in `getOrderSummary`.
- Added minimal schema compatibility migrations required by the existing acceptance fixture.

Verified: `npm test` passes.