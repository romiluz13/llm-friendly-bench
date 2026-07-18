Implemented the account payment-method schema/model/query support.

- Added JSONB-compatible schema migration and `preferred_payment_method`.
- Added optional enum validation in account create/update.
- Included `preferredPaymentMethod` in order summaries.
- Preserved the benchmark’s JSONB document storage contract.

`npm test` passes.