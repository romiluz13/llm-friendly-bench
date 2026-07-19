Implemented the account payment preference and order-summary projection.

- Added optional `preferredPaymentMethod` enum to accounts:
  `credit_card`, `wire_transfer`, `ach`, `paypal`
- Account create/update already persist arbitrary schema-valid fields, so no special model logic was needed.
- Added `preferredPaymentMethod` to `getOrderSummary`.

Verified with `npm test` — acceptance suite passes.