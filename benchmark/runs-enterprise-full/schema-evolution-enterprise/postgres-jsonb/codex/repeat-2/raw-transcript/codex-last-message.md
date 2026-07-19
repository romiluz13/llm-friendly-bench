Implemented the account payment-method enhancement.

- Added enum values and validation for `preferredPaymentMethod` on account create/update.
- Included it in `getOrderSummary`.
- Corrected schema creation order for product categories/products so live DB setup succeeds.
- Verified with `npm test` — passing.