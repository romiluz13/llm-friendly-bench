Implemented the account payment preference migration.

- Added optional enum validation for `preferredPaymentMethod`.
- Added create/update validation and persistence support.
- Included it in `getOrderSummary`.
- Kept legacy fixture documents compatible during schema setup.

`npm test` passes.