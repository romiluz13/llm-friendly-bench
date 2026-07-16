Implemented `riskScore` support in `src/schema.mjs` and `src/accounts.mjs`.

- Optional integer column constrained to 0–100, including migration for existing tables
- Included in create, get, and update paths
- Existing CRUD behavior preserved

`npm test` passes.