Implemented the brownfield schema evolution:

- [schema.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-5/workspace/src/schema.mjs): optional `riskScore` BSON `int` constrained to 0–100; migrates existing collections via `collMod`.
- [accounts.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/mongo/codex/repeat-5/workspace/src/accounts.mjs): updates now ensure the migrated validator before writing. Existing generic create/get/update paths already persist and return `riskScore`.

Static validation passed: `node --check` for both files and `git diff --check`.

Live acceptance remains blocked by the sandbox:

```text
$ npm test
exit=1
MongoServerSelectionError: connect EPERM 127.0.0.1:27018
```

The test needs to be rerun where access to the benchmark’s local MongoDB endpoint is permitted.