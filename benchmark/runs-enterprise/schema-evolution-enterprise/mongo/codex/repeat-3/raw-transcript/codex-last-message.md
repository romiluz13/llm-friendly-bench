Implemented the account payment preference across schema, model updates, and order summaries.

- Added optional enum validation for `preferredPaymentMethod`.
- Ensured account updates initialize the schema.
- Added `preferredPaymentMethod` to `getOrderSummary`.

Verified with `npm test` — acceptance suite passes.