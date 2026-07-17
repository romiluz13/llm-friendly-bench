Implemented the account payment preference support.

- Added optional `preferredPaymentMethod` enum schema support.
- Validated it in account create/update.
- Included it in `getOrderSummary`.
- Kept enterprise fixture inserts compatible with the generated schema.
- Verified with `npm test` — all acceptance tests pass.