Implemented preferred payment method support.

- Added optional constrained `accounts.preferred_payment_method`.
- Updated account create, update, and retrieval mapping.
- Included `preferredPaymentMethod` in `getOrderSummary`.
- Added live-schema compatibility migrations required by the existing acceptance fixture.

Verified: `npm test` passes.