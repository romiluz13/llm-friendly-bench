Implemented `preferredPaymentMethod` support across the account model and order summary.

- Added optional enum validation for `credit_card`, `wire_transfer`, `ach`, and `paypal`.
- Persisted the field on account create/update.
- Added it to `getOrderSummary`.
- Updated schema initialization for the JSONB document-backed entities.

`npm test` passes.