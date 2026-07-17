Implemented `preferredPaymentMethod` across accounts and order summaries.

- Added optional enum-checked database column.
- Added create/update/read support in `accounts.mjs`.
- Included it in `getOrderSummary`.
- Added schema compatibility defaults required by the live enterprise fixture schema.

Verified: `npm test` passes.