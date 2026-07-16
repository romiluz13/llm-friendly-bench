Implemented `riskScore` across the existing accounts schema and CRUD.

- Added optional `risk_score INTEGER` with a 0–100 constraint and safe schema evolution.
- Included `riskScore` in create, get, and update operations.
- Verified with `npm test` — all acceptance and regression tests pass.