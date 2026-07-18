Implemented the account payment preference and order-summary inclusion.

- `accounts.preferred_payment_method` is optional and constrained to the requested values.
- Account create, read, and update now handle `preferredPaymentMethod`.
- `getOrderSummary` returns `preferredPaymentMethod`.
- Added live-schema compatibility required for the existing regression fixture.

Verified: `npm test` passes.