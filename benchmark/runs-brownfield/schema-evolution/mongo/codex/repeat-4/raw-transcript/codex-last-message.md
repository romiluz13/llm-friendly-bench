Implemented `riskScore` support in [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-4/workspace/src/schema.mjs) and [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-4/workspace/src/accounts.mjs).

- Live validator now allows optional integer `riskScore` from 0–100 and upgrades existing collections via `collMod`.
- Create/update preserve optional score semantics; get already returns stored fields unprojected.
- No test or protected DB files changed.

Verified:

```text
npm test
exit=0
Build-Bench brownfield acceptance passed: mongo/schema-evolution
```

Also verified against the live database: `riskScore: 101` is rejected by the validator.