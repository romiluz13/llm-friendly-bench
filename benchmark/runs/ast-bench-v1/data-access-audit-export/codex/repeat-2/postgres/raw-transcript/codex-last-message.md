Implemented the workflow in [src/workflow.mjs](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs/ast-bench-v1/data-access-audit-export/codex/repeat-2/postgres/workspace/src/workflow.mjs#L4).

- Reconstructs the normalized Postgres scope from accounts, contract, contacts, activities, owner groups, and risk signals.
- Persists `workflow_state`, `owner_tasks`, `customer_messages`, and `audit_events`, including a SHA-256 hashable payload trail.
- Keeps the portal projection behavior intact, so the acceptance status and visible summary now resolve correctly.
- `npm test` passes.
- I also ran `node src/render-proof.mjs` successfully.
- I couldn’t create a git commit here because `git add` is blocked from creating `.git/index.lock` in this sandbox.

