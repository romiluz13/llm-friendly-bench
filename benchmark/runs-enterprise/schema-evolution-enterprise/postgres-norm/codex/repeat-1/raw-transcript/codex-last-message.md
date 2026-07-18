Implemented the account payment preference end-to-end.

- Added nullable `preferred_payment_method` with enum validation.
- Added create/update/retrieval support in accounts.
- Included `preferredPaymentMethod` in order summaries.
- Aligned schema compatibility for existing acceptance fixtures.

Verified with `npm test`:

`Build-Bench enterprise acceptance passed: postgres-norm`