Implemented the schema evolution in [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-1/workspace/src/schema.mjs:4):

- Adds optional `riskScore` as BSON `int`, bounded `0–100`.
- Applies the validator on both new collections and existing ones via `collMod`.
- Left `accounts.mjs` unchanged: its existing create/get/update paths already preserve optional fields.

Verified: syntax, diff hygiene, and both schema-application paths pass locally. Independent review found no issues.

`npm test` could not reach its first assertion: it exits 1 because the sandbox blocks `127.0.0.1:27018` with `connect EPERM`. No fallback or test change was added.

