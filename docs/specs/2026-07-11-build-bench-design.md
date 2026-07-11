# Build-Bench: Comprehensive LLM-Friendly DB Build Benchmark

**Status:** Design approved 2026-07-11. Planning only — no production code until tickets are implemented.
**Relationship to v3:** New benchmark alongside v3. v3 stays as the narrow single-outcome proof (strategic-account-rescue, fill-in `src/workflow.mjs`, 3 lanes). Build-bench is the broader, comprehensive build-task matrix.

---

## Purpose

Build-bench measures which database is most LLM-friendly **to build with** — to make a feature run and work against a live DB, honestly and optimally. It is a **build-time** benchmark, not a production-performance benchmark. The databases are the **subject under test**; Claude Code and Codex are independent **measuring instruments**.

The benchmark exists to answer, with real evidence: *when an AI coding agent builds the same feature against different databases, which database requires less agent work — and does the relational penalty grow with schema depth or paradigm complexity?*

---

## Target matrix

```
5 lanes × 4 task types × 2 agents × 5 repeats = 200 cells
```

### Lanes (5)

| Lane | Paradigm | Designed by |
| ------ | ---------- | ------------- |
| `mongo` | Document, schema-on-read | Authors |
| `postgres-norm` | Relational, normalized, join burden | External Postgres engineer (EEO) |
| `postgres-jsonb` | Relational hybrid, JSONB + GIN | External Postgres engineer (EEO) |
| `sqlite` | Embedded relational, dialect limits | External SQLite engineer (EEO) |
| `prisma-on-postgres` | ORM abstraction, compiler safety net | ORM specialist (EEO) |

MySQL and a second document store are excluded as same-paradigm noise (research: `research-db-scope`).

### Task types (4)

1. **Greenfield schema + CRUD resource** — design schema, implement CRUD, migration, tests hit live DB.
2. **Schema evolution / migration** — ALTER/change on existing schema, old tests must pass + new tests pass.
3. **Query / analytics feature** — read-heavy aggregate/join/filter/paginate, schema pre-seeded, tests assert returned rows.
4. **New relationship integration** — connect two existing resources (junction vs embedded), migration + queries + tests.

All tasks verified by tests passing **AND** live-DB writes/queries verified — no mocks.

### Agents (2)

- Claude Code — Sonnet 4.6 (`--model sonnet`)
- Codex — `gpt-5.4-mini`
- Pinned to cheap tiers deliberately (secondary thesis: you don't need the most expensive model to build well).
- **Within-agent rule (non-negotiable):** only Claude-vs-Claude and Codex-vs-Codex comparisons are valid. Never compare absolute token counts across the two CLIs. `tokensRead = inputTokens + cachedInputTokens` normalizes within each agent's own reporting.

### Repeats

5 per cell, reported as **medians + IQR**. Single-cell tokens are raw evidence, not a result.

---

## Phasing (each phase is independently defensible)

| Phase | Matrix | Ships a result |
| ------- | -------- | ---------------- |
| **P1 — Core proof** | 3 lanes (mongo/pg-norm/pg-jsonb) × greenfield-CRUD × 2 agents × 5r = 30 cells | "Fair fight, one build task" |
| **P2 — Paradigm expansion** | +sqlite, +prisma = 5 lanes × greenfield-CRUD × 2 agents × 5r = 50 cells | "Does paradigm axis matter?" |
| **P3 — Task-type expansion** | 5 lanes × 4 task types × 2 agents × 5r = 200 cells (full) | The comprehensive claim |

P1 reuses v3's proven live-DB + anti-cheat harness almost directly. New code per phase: lane adapters (sqlite, prisma in P2), task-type workspace generators + migration-eval verification (P3).

---

## Fairness mechanism (EEO + red-team + pre-registration)

### Equal-Effort Opponent lane design

Each non-MongoDB lane is designed by a devoted expert for that DB, tuned to its idiomatic ceiling within a fixed resource budget. Authors own only the MongoDB lane. Designers are **blind to the opponent's lane** — they cannot see the MongoDB design.

**Lane designer contract (published as `docs/fairness-contract.md`):**

- Same task specs, same acceptance contract, same resource budget (time + model access).
- Produce their lane's schema/migration/reference-solution for all 4 task types, optimized to idiomatic best practice.
- Document every design choice with rationale (why this normalization, why this index, why this embed shape).
- Cannot see the MongoDB lane's design.

### Red-team phase (after lane design, before any agent runs)

- Each designer audits the opponent's lane for strawman designs, missing indexes, unidiomatic choices, configuration bias.
- Findings filed as issues; lane owner must fix or formally defend.
- Iterate until no structural "free win" remains.
- Logged and published as evidence: "here's how we tried to break the Postgres lane and what we fixed."

### Pre-registration (locks protocol before data collection)

Hypotheses, full task set, metrics, analysis plan, and lane designs are timestamped and archived (OSF/AsPredicted or immutable git tag + SHA manifest) **before any agent runs**. After registration, the task set and lane designs are frozen — no adding/removing tasks because early results look bad.

**Pre-registered hypotheses:**

- **H1:** MongoDB requires less agent work (`tokensRead`) than any relational lane, within-agent.
- **H2:** The relational penalty grows with schema normalization depth (postgres-norm > postgres-jsonb > mongo).
- **H3:** ORM abstraction (Prisma) recovers some but not all of the relational penalty.
- **H4 (pre-registered null):** SQLite may differ on the operational axis but not predictably on the schema axis.

---

## Task design

### Shared domain

Reuses the existing `customer-order-lifecycle` scenario (accounts, orders, line items, invoices, shipments, support, contacts). Already de-leaked, already has a derivation oracle. No new fixture world.

### Per-task-type contract

**Task type 1 — Greenfield schema + CRUD resource**

- Agent edits: schema definition (DDL / collection validator / Prisma schema), migration, model layer, CRUD handlers.
- Verification: tests insert via handlers → query live DB directly → assert rows match. `verifyLiveWrite`: harness dumps live table/collection after run, asserts expected rows exist.

**Task type 2 — Schema evolution / migration**

- Agent edits: migration script, updated model/handlers, optional backfill.
- Verification: old test suite (Pass-to-Pass, must not break) + new test suite (Fail-to-Pass) + `verifyLiveSchema`: harness inspects live DB schema after run (column/field exists, old data intact).

**Task type 3 — Query / analytics feature**

- Agent edits: query code / read models. Schema pre-seeded, not editable.
- Verification: tests call query handler → assert returned data matches expected. `verifyLiveQuery`: harness runs reference query against seeded live DB, diffs against agent's output.

**Task type 4 — New relationship integration**

- Agent edits: migration (junction table / FK / embedded array), updated handlers/queries, tests.
- Verification: tests assert related data created and queried correctly. `verifyLiveRelationship`: harness asserts junction table or embedded array exists with correct links.

### Cross-task design rules

- **De-leaked specs:** task prompts give the *what*, never the expected answer. Agent must derive, not copy.
- **Negative controls per task type:** each task type has a variant where the "obvious" answer is wrong, proving a copy-the-pattern solution fails.
- **Difficulty calibration:** each task type piloted at n=2-3 before the full 5-repeat run (stub fails, reference passes — same contract proof as v3).
- **Frozen workspace per cell:** git-committed before agent runs; diff taken against frozen SHA.
- **Run timeout:** ≥15 min/cell (build tasks are wider than v3's fill-in-one-function scope; canary confirmed postgres-jsonb needs >10 min).

---

## Integrity & anti-cheat (extending v3)

### Edit allow-list (per task type)

- **Editable:** `src/` (schema, migration, model, handlers — whatever the task type requires).
- **Protected (touch = fail):** `tests/`, `db-config.json`, `RULES.md`, `package.json`, `src/db.mjs` (connection helper), any `data/` or `fixtures/`.
- **Schema-hash check:** harness records post-migration live DB schema, compares against reference solution's schema shape. Catches "agent faked the migration by editing the test."

### Source-pattern scan (extended from v3)

- `file-fallback-db` (v3, still applies).
- `global-injection` (v3, still applies).
- **New — `test-stub-db`:** scan changed source for hardcoded return values matching expected test outputs, mock DB clients, `if (process.env.NODE_ENV === 'test')` shortcuts.
- **New — `schema-skip`:** scan for migration scripts that no-op or `CREATE IF NOT EXISTS` without the required columns/fields.

### Live-DB verification (per task type — the strongest layer)

The harness never trusts `npm test` output alone. After the run, it queries the live DB directly — independent of agent code:

| Task type | Live-DB check |
| ----------- | --------------- |
| Greenfield CRUD | `verifyLiveWrite`: expected rows exist after create/update/delete cycles |
| Schema evolution | `verifyLiveSchema`: expected new column/field exists, old data intact |
| Query/analytics | `verifyLiveQuery`: reference query vs agent output diff |
| Relationship | `verifyLiveRelationship`: junction table or embedded array has correct links |

### BenchJack-aware defense

Research (`research-fairness`) showed BenchJack found 8/8 major benchmarks exploitable — the most common exploit was reading answer keys shipped with tests. Build-bench defense: test files contain only assertions, never expected values; expected values live in a protected reference module the agent cannot read; live-DB verification computed at harness level, not embedded in the workspace.

### Carried over from v3 (unchanged)

- Frozen-commit diff (agent's commits can't hide changes).
- Deterministic per-run DB namespace (`buildbench_<task>_<lane>_<agent>_r<repeat>`).
- Before-state must fail (stub `npm test` fails before any agent work).
- Real measured tokens (`tokensRead = input + cached`, within-agent only).

---

## Metrics & reporting

### Primary metric

`tokensRead = inputTokens + cachedInputTokens`, within-agent only. Never compare absolute numbers across agents.

### Secondary metrics (all captured per cell, reported as 5-repeat medians + IQR)

| Metric | What it measures |
| -------- | ----------------- |
| `tokensRead` (primary) | Context read — the core LLM-friendliness signal |
| `outputTokens` | Code written — more writes can mean more boilerplate |
| `toolCalls` | Tool turns — more turns = more steering |
| `retries` | Failed verify → retry loops — stuck-ness signal |
| `wallClockSec` | Elapsed time (canary: mongo ~7min, postgres-jsonb >10min) |
| `diffLOC` | Lines changed in `src/` — change footprint |
| `filesTouched` | Files edited — change spread |
| `pass` (bool) | Tests + live-DB check both pass — gate; non-passing cells excluded from token medians |

### Reporting structure (matches phasing)

- **P1 report:** 3 lanes × 1 task type. Within-agent deltas, medians + IQR, negative-control results.
- **P2 report:** +sqlite, +prisma. "Does paradigm axis matter?"
- **P3 report:** Full 5×4 matrix. Pre-registered hypotheses H1-H4 marked confirmed/refuted/inconclusive.

### Honesty rules (carried from v3)

- No final numbers until the phase's batch completes.
- Single-cell tokens are raw evidence, not a result — no trend-reading from n=1.
- 5-repeat medians are the verdict. Wild swing → report the IQR, don't smooth.
- If a pre-registered hypothesis is refuted by the data, report it as refuted.

### What this benchmark will NOT claim (pre-registered limits)

- Not production performance — build-time work only.
- Not cross-agent absolute comparison — within-agent only.
- Not "MongoDB is always better" — task-type breakdown may show relational wins on specific task types (e.g., query/analytics where joins are idiomatic). Report honestly.
- No claim until the EEO independent Postgres-fairness review signs off.

---

## Harness reuse & new code

### Reused from v3 (extended, not replaced)

- `scripts/benchmark-livedb.mjs` — lane adapters (seed / dump / teardown). Extended with sqlite + prisma adapters in P2.
- `scripts/benchmark-run-v3.mjs` — seed → workspace → freeze git → run agent → live-DB acceptance → capture diff/tokens/cheat-signals. Extended for multi-file edits + per-task-type verification.
- Anti-cheat layer (edit allow-list, source-pattern scan, live-DB check) — extended per Section 4.

### New code

- 2 lane adapters: `sqlite`, `prisma-on-postgres` (P2).
- 3 task-type workspace generators: migration, query, relationship (P3; greenfield-CRUD reuses v3's workspace generator pattern, adapted for multi-file).
- Migration-eval verification (`verifyLiveSchema`, `verifyLiveQuery`, `verifyLiveRelationship`) — P3.
- `test-stub-db` and `schema-skip` source-pattern scans — P3.
- `docs/fairness-contract.md` — the EEO lane designer contract.
- Pre-registration artifact (timestamped git tag + SHA manifest of task set + lane designs + analysis plan).

---

## Canary verification (2026-07-11)

v3 harness confirmed alive before planning build-bench extensions:

| Check | Result |
| ------- | -------- |
| Docker DBs up (mongo :27018, pg :5433) | ✅ both healthy |
| Contract proof (no-agent, all lanes) | ✅ 12/12 — stub fails, reference passes, copy-the-answer rejected |
| Live agent cell (mongo/codex/moderate) | ✅ clean pass, `tokensRead=1,484,540`, live-DB write verified, anti-cheat clean |
| Live agent cell (postgres-jsonb/codex) | ⏱️ timed out at 10 min — slow cell, not a failure (no manifest = didn't finish, not a false pass); confirms ≥15 min/cell timeout for build tasks |

---

## Open items (to resolve during implementation, not blocking this spec)

- Recruiting external engineers for EEO lane design (Postgres, SQLite, ORM specialist) — a people task, not a code task.
- Pre-registration hosting choice (OSF vs AsPredicted vs git tag + SHA manifest).
- Exact task-spec wording for each of the 4 task types (pilot-calibrated before full run).
- Whether P2's Prisma lane uses Postgres-normalized or Postgres-JSONB as its underlying DB (decide during P2 lane design).
