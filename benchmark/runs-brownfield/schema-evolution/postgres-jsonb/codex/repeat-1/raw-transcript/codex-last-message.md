Implemented the JSONB-backed `riskScore` evolution:

- [`src/schema.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-1/workspace/src/schema.mjs:5) now validates optional integer scores from 0–100 and safely migrates the existing table.
- [`src/accounts.mjs`](/Users/rom.iluz/Dev/sql-hidden-cost/benchmark/runs-brownfield/schema-evolution/postgres-jsonb/codex/repeat-1/workspace/src/accounts.mjs:3) validates scores during create/update while preserving JSONB CRUD reads and updates.
- Only permitted `src/` files changed; no fallback storage was added.

Verification: syntax and diff checks passed. `npm test` cannot reach the live PostgreSQL instance in this sandbox: `connect EPERM 127.0.0.1:5433`. The acceptance suite therefore remains unverified here.