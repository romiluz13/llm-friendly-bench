# Research: MongoDB vs Postgres — Brownfield Token Economics for AI Coding Agents

## Summary

Input tokens dominate AI coding agent costs (~1000x more than code chat), and the bulk go to reading/understanding existing context. MongoDB's document model reduces context burden per task (fewer artifacts to read, no migration scripts to generate), but its schemalessness shifts validation cost to read-time, creating deferred technical debt that can *increase* context load in mature brownfield codebases. Postgres's explicit schema is a navigation map that keeps AI agents grounded but requires multi-step expand-contract migrations that consume significant output tokens and retries.

## Findings

1. **Input tokens dominate; agents pay to re-read context every turn.** The Stanford/MIT study (Brynjolfsson, Pentland, Pei, 2026) found agentic coding tasks consume ~1000x more tokens than code chat, with the vast majority being *input* tokens. Because agents lack persistent memory between loop turns, every action re-sends the entire accumulated context — "one big pricey context snowball." Cost variance reaches 30x on identical tasks. [Stanford Digital Economy Lab](https://digitaleconomy.stanford.edu/news/how-are-ai-agents-spending-your-tokens/) | [arXiv 2604.22750](https://arxiv.org/abs/2604.22750)

2. **MongoDB schema evolution is cheaper per-change but defers cost.** Adding a field in MongoDB requires no DDL — the agent simply writes to the new field; existing documents stay as-is. Official MongoDB docs recommend the Schema Versioning Pattern (`schema_version` field + application-side hydration). PostgreSQL `ALTER TABLE ADD COLUMN` with a constant default is O(1) metadata-only since PG 11, but adding `NOT NULL` requires a 3-step backfill, and rename/type-change/split operations require expand-contract (expand → dual-write → backfill → contract), each step generating migration scripts the agent must write, test, and retry. [MongoDB Docs: Schema Validation](https://www.mongodb.com/docs/manual/core/schema-validation/) | [PostgreSQL Docs: ALTER TABLE](https://www.postgresql.org/docs/current/ddl-alter.html)

3. **Postgres expand-contract is a multi-step token multiplier.** Zero-downtime migrations require 3+ discrete steps (add column, backfill in batched chunks with sleep intervals, deploy dual-write code, drop old column). Each step is a separate agent task with its own context snowball. Backfill on large tables generates WAL bloat, replication lag, and dead tuples — operational risks the agent must reason about. For an AI agent, this means more turns, more output tokens (migration scripts), and more retries. [Crunchy Data](https://www.crunchydata.com/blog/understanding-postgres-iops) | [TigerData: Bloat Reduction](https://www.tigerdata.com/learn/how-to-reduce-bloat-in-large-postgresql-tables)

4. **Text-to-SQL accuracy collapses with schema size and join count.** BIRD benchmark: 1-table queries ~97% accuracy; 3–4 tables ~80%; 5+ join queries are "primary failure points" hitting near 0% without agentic frameworks. Spider 2.0 (200–1000+ tables): 6–21% accuracy. Schema linking (column F1 ~51–61% on enterprise schemas) is the bottleneck, not SQL syntax. Oracle hints (pre-selecting tables/joins) jump accuracy from ~11% to 30%+, proving the reconstruction burden is real. [BIRD benchmark analysis](https://www.researchgate.net/figure/BIRD-execution-accuracy-by-difficulty-level-Both-conditions-use-the-same-model-and_tbl2_408236293) | [Spider 2.0](https://arxiv.org/abs/2601.08778)

5. **MongoDB's document model reduces join-reconstruction burden.** Related data lives in one document (high data locality); the agent reads one collection instead of joining 5+ tables. This reduces both schema context (fewer DDL definitions to load) and reasoning steps (no join path discovery). MongoDB's own agentic dev materials argue documents "map directly to objects in application code," eliminating ORM translation layers. [MongoDB: Future of AI Software Development is Agentic](https://www.mongodb.com/company/blog/product-release-announcements/future-of-ai-software-development-is-agentic) | [MongoDB: From Prompt to Production](https://www.mongodb.com/company/blog/technical/from-prompt-production-mongodb-atlas-agentic-dev)

6. **MongoDB's schemalessness creates a hidden brownfield context tax.** Without enforced schema, the agent cannot infer document shape from DDL — it must read application code, ODM definitions (Mongoose/Prisma), or sample documents to understand what fields exist. In inconsistent legacy data, the agent must handle multiple document versions with defensive null-checking logic. One analysis describes this as "schema-on-read" where "a new engineer must read through months of Git history and defensive application code to understand what the data might look like." This *increases* reading tokens — the exact cost that dominates. [Hidden Cost of Schemaless Databases](https://tech-couch.com/post/the-hidden-cost-of-schemaless-databases) | [MongoDB: Cost Optimization with Document Size](https://www.mongodb.com/company/blog/technical/cost-optimization-with-optimal-document-size)

7. **Postgres explicit schema is a grounding advantage for AI agents.** DDL acts as a self-describing navigation map — the agent reads `schema.sql` and instantly knows every table, FK, and constraint. In brownfield with 50+ tables, this explicit relationship graph enables high-accuracy reasoning. Community analysis rates Postgres text-to-SQL at ~90% accuracy vs MongoDB MQL at ~70%, with Postgres hallucination rated low (constrained by column list) vs MongoDB high (agent invents fields). [AIMultiple: Text-to-SQL](https://aimultiple.com/text-to-sql)

## Contradictions

- **MongoDB marketing vs independent analysis:** MongoDB's own materials emphasize flexibility as a productivity win for agents. Independent sources note the flexibility advantage is strongest for *adding new features* (no migration friction) but weakest for *brownfield comprehension and refactoring* (schemaless data requires reading code to infer structure). The net token advantage depends on task type.
- **"Fewer collections" vs "larger documents":** MongoDB reduces the number of entities to trace but each document is larger and may contain unbounded arrays (the "large document tax"), which can increase per-read token cost.

## Sources

- Kept: Stanford Digital Economy Lab / arXiv 2604.22750 — primary source on token economics (input dominance, 1000x, 30x variance)
- Kept: MongoDB official blog (agentic dev, MCP Server GA) — primary source for MongoDB's own AI-agent positioning
- Kept: PostgreSQL docs (ALTER TABLE) — primary source for migration mechanics and O(1) vs O(N) behavior
- Kept: MongoDB docs (schema validation, best practices) — primary source for schema versioning pattern
- Kept: BIRD/Spider 2.0 benchmark research — quantitative evidence on accuracy degradation with join/table count
- Kept: Tech-couch "Hidden Cost of Schemaless" — independent analysis of deferred validation costs
- Kept: Crunchy Data / TigerData — PostgreSQL backfill operational costs
- Dropped: Medium/blog commentary without primary citations — SEO-heavy, no original data

## Gaps

- No direct benchmark comparing MongoDB vs Postgres *token consumption* for identical brownfield AI coding tasks. The evidence is inferential (combining token economics research + text-to-SQL accuracy + schema evolution mechanics).
- No published study measuring AI agent retries specifically on expand-contract migrations vs MongoDB lazy migrations.
- MongoDB's "schemaless" advantage may be neutralized if the project uses Prisma/Mongoose (schema-as-code), which re-introduces explicit schema definitions — making both databases comparable for AI context.
- The benchmark's own annotation errors (52.8% error rate found in BIRD Mini-Dev) mean some accuracy degradation numbers may be inflated.