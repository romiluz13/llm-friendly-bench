Implemented the account payment-method enhancement.

- Added optional `accounts.preferredPaymentMethod` enum:
  `credit_card`, `wire_transfer`, `ach`, `paypal`
- Added model validation on account create/update.
- Included `preferredPaymentMethod` in `getOrderSummary`.

Verified with `npm test` — acceptance suite passes.