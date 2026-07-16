Added `riskScore` to the live accounts validator as an optional integer bounded 0–100, including `collMod` so existing collections are evolved: [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-1/workspace/src/schema.mjs:4).

`accounts.mjs` already generically persists, returns, and updates supplied fields, so no change there was needed.

Verified:

- `npm test` → `Build-Bench brownfield acceptance passed`
- Live validator rejects `riskScore: 101`
- Only `src/schema.mjs` changed; protected files untouched.

