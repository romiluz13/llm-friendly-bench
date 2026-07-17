Implemented preferred payment method support.

- Added optional enum validation for `credit_card`, `wire_transfer`, `ach`, and `paypal`.
- Stored it through account creation and updates.
- Added `preferredPaymentMethod` to `getOrderSummary`.
- Made schema initialization compatible with the live enterprise database’s existing relational constraints.

`npm test` passes.