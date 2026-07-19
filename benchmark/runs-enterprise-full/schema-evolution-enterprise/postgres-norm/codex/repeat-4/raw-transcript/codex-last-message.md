Implemented `preferredPaymentMethod` end-to-end:

- Added optional constrained column and live-schema migration in `src/schema.mjs`.
- Updated account create, update, and retrieval mapping in `src/accounts.mjs`.
- Included it in `getOrderSummary` in `src/queries.mjs`.

Verified with `npm test`:

`Enterprise benchmark acceptance passed: postgres-norm`