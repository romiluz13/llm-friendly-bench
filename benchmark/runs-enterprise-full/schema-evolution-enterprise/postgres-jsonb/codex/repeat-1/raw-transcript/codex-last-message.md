Implemented the account payment preference and order-summary projection.

- Added allowed enum values in `src/schema.mjs`.
- Validated optional `preferredPaymentMethod` in account create/update.
- Added `preferredPaymentMethod` to `getOrderSummary`.
- Fixed the existing `product_categories` creation order so the schema initializes successfully.

Verified: `npm test` passes (`Enterprise benchmark acceptance passed: postgres-jsonb`).