Implemented the optional `riskScore` field (integer 0–100).

- Added an idempotent JSONB database constraint in `src/schema.mjs`.
- Validated `riskScore` on account create and update in `src/accounts.mjs`.
- Preserved existing CRUD behavior; no changes to `src/db.mjs` or tests.

Verification:

```text
$ npm test
exit=0
Build-Bench brownfield acceptance passed: postgres-jsonb/schema-evolution
```