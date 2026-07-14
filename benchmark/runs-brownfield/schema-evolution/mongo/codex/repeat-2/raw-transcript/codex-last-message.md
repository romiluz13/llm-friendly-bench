Implemented the `riskScore` evolution.

- [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-2/workspace/src/schema.mjs:14) now validates an optional BSON integer from 0–100 and applies it to existing collections via `collMod`.
- [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-2/workspace/src/accounts.mjs:3) persists supplied scores on create/update; reads already return the stored document.
- Syntax and diff checks pass. Standards/spec review found no issues.

`npm test` remains blocked by the sandbox, not the code: MongoDB connection to `127.0.0.1:27018` fails with `EPERM` before any acceptance assertion runs. No fallback or test changes were added. Run `npm test` where that live database is accessible to complete the required gate.

