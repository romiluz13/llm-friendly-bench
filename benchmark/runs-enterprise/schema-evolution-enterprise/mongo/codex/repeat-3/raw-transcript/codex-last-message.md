Implemented the account payment preference across schema, model, and order summary.

- Added optional enum validation for `preferredPaymentMethod`.
- Account create/update now support it; create supplies schema-required `createdAt`.
- `getOrderSummary` returns `preferredPaymentMethod`.

Verified with `npm test` — acceptance suite passes.