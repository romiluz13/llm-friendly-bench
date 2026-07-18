Implemented `preferredPaymentMethod` for accounts and exposed it in `getOrderSummary`.

- Added optional enum schema metadata and validation.
- Create/update persist the field in account JSONB documents.
- Order summaries now return `preferredPaymentMethod`.
- Added compatible JSONB document-column migration in `src/schema.mjs`.

Verified: `npm test` passes.