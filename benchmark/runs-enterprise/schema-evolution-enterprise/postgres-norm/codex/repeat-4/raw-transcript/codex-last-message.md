Implemented the account payment preference and order-summary exposure.

- `accounts.preferred_payment_method`: optional DB-enforced enum
- Create/update/get account support
- `getOrderSummary` includes `preferredPaymentMethod`
- Aligned schema bootstrap with the existing acceptance setup

Verified: `npm test` passes.