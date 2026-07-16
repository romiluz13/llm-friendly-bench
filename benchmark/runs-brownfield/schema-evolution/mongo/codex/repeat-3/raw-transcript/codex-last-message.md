Added optional `riskScore` to the MongoDB accounts validator as an integer constrained to 0–100.

Existing generic CRUD already preserves optional fields in create, get, and update. `npm test` passes, including regression and `riskScore` coverage.