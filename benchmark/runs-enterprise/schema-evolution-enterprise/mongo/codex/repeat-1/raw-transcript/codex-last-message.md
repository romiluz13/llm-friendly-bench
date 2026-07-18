Implemented the account payment preference support.

- Added optional enum validation for `preferredPaymentMethod`.
- Stored it through account create/update.
- Added it to `getOrderSummary`.
- Account creation now supplies the schema-required `createdAt`.

Verified with `npm test` — passing.