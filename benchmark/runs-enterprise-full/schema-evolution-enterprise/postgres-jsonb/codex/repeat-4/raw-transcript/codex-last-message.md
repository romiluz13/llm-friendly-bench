Implemented the account payment preference and order-summary field.

- Added allowed methods: `credit_card`, `wire_transfer`, `ach`, `paypal`
- Create/update now validate and store `preferredPaymentMethod`
- `getOrderSummary` returns `preferredPaymentMethod`
- Fixed the pre-existing product-category schema creation order that blocked database initialization

Verified: `npm test` passes.