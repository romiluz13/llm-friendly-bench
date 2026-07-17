Implemented the account payment preference and order-summary exposure.

- `accounts.preferred_payment_method`: nullable, constrained to the four requested values.
- Account create, read, and update handle `preferredPaymentMethod`.
- `getOrderSummary` returns `preferredPaymentMethod`.
- Aligned live-schema defaults/constraints needed by the existing acceptance fixture.

Verified: `npm test` passes.