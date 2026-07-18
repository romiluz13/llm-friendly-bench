Implemented `preferredPaymentMethod` support across accounts and order summaries.

- Optional enum validation and database constraint added.
- Account create/update persists the field.
- `getOrderSummary` now returns `preferredPaymentMethod`.
- Aligned the generated database schema with the existing JSONB-based account/order/invoice code paths.

Verified with `npm test` — acceptance suite passes.