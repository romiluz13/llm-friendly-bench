Implemented the account payment preference and order-summary exposure.

- Added allowed enum values: `credit_card`, `wire_transfer`, `ach`, `paypal`
- Validates the optional field on account create/update
- Includes `preferredPaymentMethod` in `getOrderSummary`
- Fixed schema table creation order so initialization succeeds

Verification: `npm test` passes.