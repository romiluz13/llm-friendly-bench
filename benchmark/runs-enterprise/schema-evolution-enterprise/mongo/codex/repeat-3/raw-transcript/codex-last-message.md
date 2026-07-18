Implemented preferred payment method support.

- Added optional enum validation to the `accounts` schema.
- Validated the field in account create/update flows.
- Included `preferredPaymentMethod` in `getOrderSummary`.

Verified with `npm test` — acceptance suite passes.