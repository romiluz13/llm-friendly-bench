Implemented preferred payment methods across accounts and order summaries.

- Added optional, constrained `preferred_paymentMethod` storage.
- Updated account create, update, and retrieval mappings.
- Added `preferredPaymentMethod` to `getOrderSummary`.
- Restored required live-schema compatibility defaults for existing acceptance fixtures.

Verified: `npm test` passes.