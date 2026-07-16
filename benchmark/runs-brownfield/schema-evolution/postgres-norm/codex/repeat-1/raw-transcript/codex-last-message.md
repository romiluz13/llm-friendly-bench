Implemented `riskScore` in the accounts schema and CRUD.

- Added nullable `risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100)` plus idempotent live-schema migration.
- Added create/get/update mapping for `riskScore`.
- Modified only `src/schema.mjs` and `src/accounts.mjs`.

Verified fresh against the live database:

```text
npm test
Build-Bench brownfield acceptance passed: postgres-norm/schema-evolution
```