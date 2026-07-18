Implemented preferred payment method support.

- `accounts` JSONB schema accepts optional `credit_card`, `wire_transfer`, `ach`, or `paypal`.
- Account create/update validates and stores it.
- Order summaries now include `preferredPaymentMethod`.

Verified with `npm test` — all acceptance tests pass.