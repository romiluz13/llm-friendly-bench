Implemented the account payment preference and order-summary inclusion.

- Added optional `preferredPaymentMethod` enum to accounts.
- Added create/update validation for `credit_card`, `wire_transfer`, `ach`, or `paypal`.
- Included it in `getOrderSummary`.

`npm test` passes.