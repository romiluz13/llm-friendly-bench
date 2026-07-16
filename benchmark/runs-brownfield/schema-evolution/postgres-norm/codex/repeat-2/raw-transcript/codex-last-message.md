Implemented `riskScore` across schema and account CRUD.

- Added nullable `risk_score INTEGER` constrained to 0–100, including migration for existing tables.
- Added riskScore to create, get, and update mappings.
- Verified with `npm test` — acceptance passed.