Implemented `riskScore` support in the accounts schema and CRUD code.

- Optional `risk_score INTEGER` with `0–100` database constraint
- Existing databases migrate via `ADD COLUMN IF NOT EXISTS`
- Create, get, and update now handle `riskScore`
- `npm test` passes.