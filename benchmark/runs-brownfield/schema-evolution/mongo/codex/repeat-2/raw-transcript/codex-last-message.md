Implemented `riskScore` in [src/schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-2/workspace/src/schema.mjs:3):

- Optional BSON `int`, constrained to 0–100.
- Applies the validator both to new collections and existing `accounts` collections via `collMod`.
- Left `accounts.mjs` unchanged: its existing create spread, full-document get, and `$set` update already persist and return `riskScore`.

Verified the live validator and ran:

```text
npm test
Build-Bench brownfield acceptance passed: mongo/schema-evolution
```

