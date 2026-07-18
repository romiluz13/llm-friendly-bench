Implemented `preferredPaymentMethod` end-to-end:

- Added nullable enum-constrained account column in schema migration.
- Updated account create/read/update handling.
- Included it in `getOrderSummary`.
- Preserved JSONB order/invoice compatibility.

Verified with `npm test`:

`Build-Bench enterprise acceptance passed: postgres-jsonb`