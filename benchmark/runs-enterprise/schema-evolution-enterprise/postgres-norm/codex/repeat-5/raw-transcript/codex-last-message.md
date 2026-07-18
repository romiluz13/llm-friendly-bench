Implemented `preferredPaymentMethod` across the account schema, account create/update/read mapping, and order summary query.

Also aligned schema initialization with the live acceptance fixture requirements. Verification passed:

`npm test` → `Build-Bench enterprise acceptance passed: postgres-norm`