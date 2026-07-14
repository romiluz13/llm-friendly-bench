Implemented the brownfield schema evolution.

- [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-1/workspace/src/schema.mjs#L3) adds a shared validator with optional `riskScore` bounded to `0..100` as an integer.
- [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-1/workspace/src/schema.mjs#L18) now applies that validator with `collMod` when `accounts` already exists, so the schema evolves instead of only being set on first create.
- [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-1/workspace/src/accounts.mjs#L3) and [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-1/workspace/src/accounts.mjs#L11) already preserve `riskScore` through the existing create/get pass-through, and [src/accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-1/workspace/src/accounts.mjs#L14) now re-runs schema setup before update.

`node` import/syntax checks pass. `npm test` still cannot complete in this sandbox because the shell cannot reach `127.0.0.1:27018`.

