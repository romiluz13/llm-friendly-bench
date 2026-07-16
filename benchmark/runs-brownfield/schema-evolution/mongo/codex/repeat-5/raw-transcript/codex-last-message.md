Added optional `riskScore` validation (`int`, 0–100) and evolved existing collections with `collMod`.

`createAccounts`, `getAccounts`, and `updateAccounts` already pass arbitrary document fields through correctly, so no CRUD rewrite was needed.

Verified: `npm test` passes.