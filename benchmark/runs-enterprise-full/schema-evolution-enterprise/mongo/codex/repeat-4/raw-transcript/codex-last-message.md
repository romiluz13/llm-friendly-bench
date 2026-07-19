Implemented the optional `preferredPaymentMethod` account field with the required enum values.

Updated:

- `src/schema.mjs` — schema enum
- `src/accounts.mjs` — create/update validation
- `src/queries.mjs` — order summary output

Verified: `npm test` passes.