Implemented `preferredPaymentMethod` across the account schema, create/update model, and order summary query.

Also restored legacy schema defaults/constraints needed by the regression fixture.

Verified with `npm test`:

`Build-Bench enterprise acceptance passed: postgres-norm`