Implemented `riskScore` across the existing account schema and CRUD.

- Added nullable `risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100)`.
- Migrates existing tables with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Create, get, and update now support `riskScore`.
- Existing behavior remains intact.

`npm test` passes.