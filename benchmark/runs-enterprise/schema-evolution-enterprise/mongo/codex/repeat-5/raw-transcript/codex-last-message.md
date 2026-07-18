Implemented account `preferredPaymentMethod` support.

- Added optional enum validation to the accounts MongoDB schema.
- `createAccount` and `updateAccount` persist the new field.
- Added `preferredPaymentMethod` to `getOrderSummary`.
- Preserved account creation compatibility by supplying `createdAt` when absent.

Verified with `npm test` — acceptance suite passes.