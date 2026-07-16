Added optional `riskScore` to the MongoDB validator as an integer constrained to 0–100.

Existing generic create/get/update code already preserves optional fields, so no CRUD rewrite was needed. `npm test` passes.