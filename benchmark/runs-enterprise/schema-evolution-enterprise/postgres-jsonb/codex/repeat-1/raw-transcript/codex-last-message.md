Implemented the account payment-method schema evolution and order-summary field.

- Added optional enum validation for `preferredPaymentMethod`
- Persisted it in account JSONB documents on create/update
- Included it in `getOrderSummary`
- Added compatible live-schema migration support

Verification: `npm test` passes.