Implemented in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/invoice-dispute-workflow/codex/repeat-1/mongo/workspace/src/workflow.mjs:3). The workflow now:
- writes a native `workflow_state` document with the exact customer-facing status, finance owner routing, risk signals, evidence bundle from the account contract plus activity timeline, and timestamps;
- persists four open owner tasks, a customer-safe portal message, and a customer-visible audit event in the document-shaped collections.

`npm test` passed.

I couldn’t create a git commit because the sandbox blocks creating `.git/index.lock`.

