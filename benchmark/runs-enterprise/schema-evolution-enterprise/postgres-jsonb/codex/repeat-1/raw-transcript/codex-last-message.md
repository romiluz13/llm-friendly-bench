Implemented `preferredPaymentMethod` across accounts and order summaries.

- Added optional enum validation and database constraint.
- Stored/retrieved it through account create/update.
- Included it in `getOrderSummary`.
- Preserved the JSONB document workflow required by the existing code.

Verified: `npm test` passes.