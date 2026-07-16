Implemented `riskScore` as an optional integer constrained to 0–100.

Updated:

- `src/schema.mjs`: adds `risk_score`, including safe evolution for an existing table.
- `src/accounts.mjs`: persists it on create and update; get continues returning it via the JSON document.

Verified: `npm test` passes.