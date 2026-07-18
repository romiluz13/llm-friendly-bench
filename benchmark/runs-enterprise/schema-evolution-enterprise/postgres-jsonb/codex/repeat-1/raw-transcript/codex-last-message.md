Implemented the account payment preference and order-summary support.

- Added optional enum validation for `preferredPaymentMethod`.
- Added JSONB compatibility schema migration for benchmark entities.
- Updated account create/update/get handling.
- Included `preferredPaymentMethod` in `getOrderSummary`.

Verified with `npm test` — acceptance passed.