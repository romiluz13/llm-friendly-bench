Implemented the account payment preference and order-summary exposure.

- Added optional `preferredPaymentMethod` enum to `accounts`:
  `credit_card`, `wire_transfer`, `ach`, `paypal`
- Order summaries now return `preferredPaymentMethod` from the account.
- Existing generic account create/update handling already persists the field.

Verified with `npm test` — acceptance suite passes.