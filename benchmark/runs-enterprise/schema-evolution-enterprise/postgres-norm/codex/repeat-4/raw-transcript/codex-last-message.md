Implemented `preferredPaymentMethod` end-to-end:

- Added nullable, constrained `accounts.preferred_payment_method`.
- Added account create/update/read support.
- Included it in `getOrderSummary` as `preferredPaymentMethod`.
- Made schema setup compatible with the existing acceptance fixtures.

`npm test` passes.