Implemented `riskScore` support.

- `src/schema.mjs`: optional JSONB `riskScore` constraint (integer 0–100) plus idempotent migration for existing tables.
- `src/accounts.mjs`: validates `riskScore` on create/update; get continues returning the stored document unchanged.

Verified against the configured live PostgreSQL database:

```text
riskScore boundary and schema checks passed
npm test
Build-Bench brownfield acceptance passed: postgres-jsonb/schema-evolution
```

