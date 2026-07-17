Implemented the account payment preference end to end.

- Added optional enum validation for `preferredPaymentMethod` in the accounts database schema.
- Added create/update validation in `src/accounts.mjs`.
- Included `preferredPaymentMethod` in `getOrderSummary`.
- Preserved account creation behavior by defaulting `createdAt` when omitted.

Verified with `npm test`:

`Build-Bench enterprise acceptance passed: mongo`