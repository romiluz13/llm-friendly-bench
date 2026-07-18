Implemented preferred payment method support.

- `accounts` schema validates optional `credit_card`, `wire_transfer`, `ach`, or `paypal`.
- Account create/update persist the field.
- Order summaries include `preferredPaymentMethod`.

`npm test` passes.