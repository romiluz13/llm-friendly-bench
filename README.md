# AST-Bench: Agent Schema Tax Benchmark

AST-Bench measures which database — **MongoDB** or **Postgres** — is more *AI-friendly*: how much work an AI coding agent has to do to build the same feature against each one. The databases are the **subject under test**. Claude Code and Codex are independent **measuring instruments** pointed at that subject.

**The within-agent rule (read this first).** Only within-agent comparisons are valid — Claude-vs-Claude and Codex-vs-Codex. **Never compare absolute token counts across the two CLIs.** They count tokens incompatibly: Codex `turn.completed.usage` is cumulative and includes cache; Claude `result.usage` is a final-turn, cache-dominated number. There is no honest conversion between them. The metric **tokensRead** = `inputTokens + cachedInputTokens` normalizes *within* each agent's own reporting, and that is the only axis on which a lane delta means anything.

---

## Status (2026-06-24): v3 is the current rigorous direction; v2 is a superseded pilot

A v2 pilot (60 runs) produced a directional, within-agent finding that MongoDB took less agent work. An adversarial code review — checked against the actual harness, not the prose — found **three real defects in v2**. We are rebuilding the benchmark as **v3** to fix all three, and the full v3 batch is **running right now**.

> **Honesty note up front:** v3 has **no final scored numbers yet.** The harness is built and proven; the 90-run batch is in progress as of this writing. v2's directional result still stands *as a pilot* but is being superseded. We will report whatever the v3 data says, including the likely outcome that the rigorous numbers are **quieter** than the leaky v2 suggested.

### What was wrong with v2, and how v3 fixes it

| # | v2 defect (verified) | v3 fix |
|---|----------------------|--------|
| 1 | **Not live-database-backed.** v2 ran `node tests/acceptance.test.mjs` against JSON files (`tables.json` / `collections.json`). There was no real database in the loop. | Every v3 run executes against **real Docker MongoDB (`127.0.0.1:27018`)** and **Postgres (`127.0.0.1:5433`)**. The agent connects with a real driver (`mongodb ^7.3`, `pg ^8.22`), reads the seeded facts, derives the answer, and **persists back to the live DB**. The acceptance test queries the live DB to verify. |
| 2 | **Answer-key leak.** v2 fixtures contained the expected status / owner list / risk signals, so an agent could "pass" by copying fields straight out of the data. | v3 **de-leaks**: fixtures hold *only raw business facts*. The agent must **derive** qualification, owner routing, and risk signals from the rules in `RULES.md`. **Negative controls** (non-qualifying accounts whose correct answer differs) prove a copy-the-answer solution is rejected. |
| 3 | **No tuned-Postgres lane** ("you didn't let me be Postgres"). v2 only ran normalized relational Postgres — not the design a senior Postgres engineer would actually reach for. | v3 adds a third lane, **`postgres-jsonb`**: a tuned single-table design with a JSONB `doc` column shaped like the Mongo document, plus a **GIN index**. This is the fair fight. |

---

## v3 experimental design

**One shared business outcome:** `strategic-account-rescue`. Combine account / contract / support / invoice / usage / shipment / regulatory / contact context for an account; decide whether it qualifies for an at-risk escalation; route the right owner groups; and produce customer-safe portal state plus an audit trail. The answer is **not in the data** — it is derived from the rules.

**Three lanes** (one lane-independent fact `world`, shaped three ways):

| Lane | Shape on disk |
| ------ | ---------------- |
| `mongo` | One access-pattern-shaped document per account in collection `accounts`. |
| `postgres-norm` | Normalized relational tables, with a **shape gradient** (see below). |
| `postgres-jsonb` | One row per account: `account_id` + a JSONB `doc` column + a **GIN index** on `doc`. |

**Postgres-norm shape gradient** (how deep the relational design is):

| Shape | Tables | Character |
| ------- | -------- | ----------- |
| `shallow` | 8 | Child facts denormalized onto the request row (`*_json` columns). |
| `moderate` | 12 | 1-to-many child tables (invoices / shipments / regulatory / support / usage). |
| `deep` | 17 | Full normalization including a `contact_x_owner_group` **many-to-many junction** plus `owner_candidate_groups` — extra reconstruction burden. |

MongoDB and `postgres-jsonb` stay one document across all shapes; only `postgres-norm` splits further as the shape deepens, so any metric difference within `postgres-norm` is attributable to schema shape alone.

**The matrix:**

```
3 shapes × 3 lanes × 2 agents (claude-code, codex) × 5 repeats = 90 live-DB runs
```

**Models are pinned to cheap tiers** — a deliberate secondary thesis: *you don't need the most expensive model to build well on MongoDB.*

- Claude Code: **Sonnet 4.6** (`--model sonnet`)
- Codex: **`gpt-5.6-terra`**

(Overridable via `ASTBENCH_CLAUDE_MODEL` / `ASTBENCH_CODEX_MODEL`.)

The single source of truth for what a correct answer is lives in `scripts/benchmark-derive.mjs` (the derivation oracle); the same rules are mirrored in prose in each workspace's `RULES.md` so the agent and the oracle agree.

---

## v3 integrity (the anti-cheat — this is the payoff of the review)

The v3 smoke run **caught a real cheat**: Codex rewrote the database connection helper to add a file-based fallback, so a run could "pass" without ever touching the live DB. That is exactly the kind of silent false-success the benchmark exists to prevent. v3 now runs a **3-layer defense**, implemented in `scripts/benchmark-run-v3.mjs`:

1. **Edit allow-list.** The agent may edit **only** `src/workflow.mjs`. Touching a protected file — `src/db.mjs`, anything under `tests/` or `data/`, `db-config.json`, `RULES.md`, `package.json` — is flagged `protected-file-modified` and the run fails.
2. **Source-pattern scan.** A regex scan over changed source flags file-fallback / in-memory-DB / snapshot patterns → `file-fallback-db` (and still catches `globalThis`/`global` injection → `global-injection`).
3. **Agent-code-independent live-DB check (`verifyLiveWrite`).** After the run, the harness dumps the live DB namespace *directly*. If a qualifying scenario left the live output tables (`workflow_state`, `owner_tasks`) empty, the run fails `live-db-not-written` — regardless of what `npm test` printed inside the workspace.

Plus the prior controls, all carried into v3:

- **Frozen-commit diff** — the workspace is `git`-committed before the agent runs; the diff is taken against that frozen SHA, so the agent's own commits can't hide changes.
- **Deterministic, versioned fixtures** — isolated per-run DB namespace (`astbench_<shape>_<lane>_<agent>_r<repeat>`) so 90 runs never collide.
- **Before-state must fail** — the no-agent proof confirms the stub `npm test` fails before any work is done, so a "pass" can't be vacuous.
- **Real measured tokens** — `tokensRead` is extracted from each CLI's actual usage events, never estimated.

---

## What is proven, and what is still running

**Proven (no agent involved):**

- The no-agent **contract proof** (`scripts/benchmark-prove-v3.mjs`) passed **12/12**: across all 3 lanes × 4 scenarios (1 primary + 3 negative controls), the stub solution **fails** `npm test` (contract is non-trivial) and the reference solution **passes** (contract is satisfiable). The negative controls additionally prove that copying the escalation answer **fails 3/3**.
- After the cheat fix, the re-smoke passed **6/6 clean** (1 shape × 3 lanes × 2 agents).

**In progress (results landing):**

- The full **90-run v3 batch** started the morning of **2026-06-24** (`scripts/benchmark-batch-v3.mjs --repeats 5`). It is **resumable** (skips cells whose manifest already shows a clean, single-file, live-DB-written pass), paces between cells to avoid rate-limit cascades, and appends a line per cell to `benchmark/runs-v3/batch-progress.log`. At ~6–7 min/cell it is expected to take roughly **8–9 hours**. It is **not finished**, so there are **no final v3 scored numbers** to report.

**Honest caveat on the early data.** At n=1 the clean v3 numbers swing a lot run-to-run. The **5-repeat medians** are what give the real verdict, and that verdict may be quieter than the leaky v2 implied. Single-cell tokens in the progress log are raw evidence, not a result — do not read a trend from them.

---

## v3 commands

Bring up the live databases (MongoDB `:27018`, Postgres `:5433`; creds `lab`/`lab`, db `sql_hidden_cost`):

```sh
npm run db:up
```

Prove the contract with no agent (stub fails, reference passes, copy-the-answer rejected):

```sh
node scripts/benchmark-prove-v3.mjs            # all lanes, all scenarios
node scripts/benchmark-prove-v3.mjs --shape deep
```

Run a single cell:

```sh
node scripts/benchmark-run-v3.mjs --shape moderate --lane mongo --agent claude-code --repeat 1
# optional: --model <override>  --scenario <negative-control-id>  --keep-ns
```

Run the full resumable batch:

```sh
node scripts/benchmark-batch-v3.mjs --repeats 5
# optional: --shapes shallow,deep  --lanes mongo,postgres-jsonb  --agents codex  --pace-ms 15000  --force
```

Live runs land under `benchmark/runs-v3/<shape>/<lane>/<agent>/repeat-<n>/` (each with `run-manifest.json`, `prompt.md`, `diff.patch`, `tests.log`, raw transcript, and `db-before/` + `db-after/` dumps). Progress: `benchmark/runs-v3/batch-progress.log`.

**v3 script map:**

| Script | Role |
| -------- | ------ |
| `scripts/benchmark-derive.mjs` | Derivation oracle + de-leaked scenarios (primary + negative controls). Single source of truth for the correct answer. |
| `scripts/benchmark-livedb.mjs` | Lane adapters: seed / dump / teardown against the live MongoDB & Postgres. |
| `scripts/benchmark-workspace-v3.mjs` | Generates the per-cell agent workspace (drivers, `src/db.mjs`, `tests/`, `RULES.md`, `db-config.json`). |
| `scripts/benchmark-run-v3.mjs` | Runs one cell end-to-end: seed → workspace → freeze git → run pinned-model agent → live-DB acceptance → capture diff/tokens/cheat-signals → teardown. |
| `scripts/benchmark-batch-v3.mjs` | Resumable full 90-cell batch with pacing and a progress log. |
| `scripts/benchmark-prove-v3.mjs` | No-agent contract proof (stub fails / reference passes / copy fails). |
| `scripts/benchmark-reference-solutions.mjs` | Reference workflow per lane, used only by the proof. |

---

## Build-Bench commands

Build-Bench is the comprehensive build-task benchmark (alongside v3). P1 is greenfield-CRUD across 3 lanes (mongo / postgres-norm / postgres-jsonb) × 2 agents × 5 repeats = 30 cells. Full design: `docs/specs/2026-07-11-build-bench-design.md`.

Prove the contract (no agent — stub fails, reference passes, per lane):

```sh
npm run buildbench:prove
```

Run a single cell:

```sh
npm run buildbench:run -- --lane mongo --agent codex --repeat 1
```

Run the full resumable P1 batch:

```sh
npm run buildbench:batch
# optional: --lanes mongo,postgres-jsonb  --agents codex  --repeats 5  --pace-ms 15000  --force
```

Score the batch (medians + IQR, within-agent deltas, H1/H2 hypothesis verdicts):

```sh
npm run buildbench:score
```

Run the test suite:

```sh
npm run buildbench:test:workspace   # workspace generator
npm run buildbench:test:anticheat   # test-stub-db + schema-skip scans
npm run buildbench:test:batch       # alreadyClean resumability logic
npm run buildbench:test:score       # scoring structure + hypothesis verdicts
```

Live runs land under `benchmark/runs-buildbench/<taskType>/<lane>/<agent>/repeat-<n>/`. Progress: `benchmark/runs-buildbench/batch-progress.log`. Summary: `benchmark/runs-buildbench/summary.json`.

**Build-Bench script map:**

| Script | Role |
| -------- | ------ |
| `scripts/benchmark-workspace-buildbench.mjs` | Multi-file workspace generator (schema + model stubs, protected db.mjs + tests). |
| `scripts/benchmark-run-buildbench.mjs` | Runs one cell: empty namespace → workspace → freeze git → agent → live-DB acceptance → capture. |
| `scripts/benchmark-batch-buildbench.mjs` | Resumable P1 batch (30 cells) with pacing + progress log. |
| `scripts/benchmark-score-buildbench.mjs` | Scoring: medians + IQR, within-agent deltas, H1/H2 verdicts. |
| `scripts/benchmark-buildbench-reference.mjs` | Reference solutions per lane (contract proof only). |
| `scripts/benchmark-prove-buildbench.mjs` | No-agent contract proof across all lanes. |

---

## Path to official MongoDB material

v3's rigor makes the work credible enough to show leadership, but it is **not** yet officially endorsed MongoDB material. Two steps remain:

1. **Independent Postgres-fairness review** — a third party confirms the normalized shapes are idiomatic, the deep 3NF design is competent (not a strawman), and the `postgres-jsonb` lane is a genuinely tuned design. v3's JSONB counter-lane **strengthens** the fairness story, but it does not **replace** external review.
2. **MongoDB brand/legal sign-off** — standard review before any external publication.

Until both are complete, this is a *"disciplined, reproducible benchmark whose authors found and fixed their own flaws"* — not endorsed marketing copy.

---

## Earlier work (kept for provenance)

### v2 — superseded pilot

The v2 pilot (`3 shapes × 2 lanes × 2 agents × 5 repeats = 60 runs`) asked whether MongoDB's advantage grows as the Postgres schema deepens, and produced a directional within-agent result. **It is superseded by v3** for the three reasons above (no live DB, answer-key leak, no tuned-Postgres lane). The v2 bundle (`benchmark/public-bundle-v2.json`) and marketing page (`prototypes/lab-console/index.html`) are still what's currently live, but should be read as a **pilot**, not a verdict.

v2 flow (for reference):

```sh
node scripts/benchmark-validate.mjs --suite ast-bench-v2
node scripts/benchmark-prepare.mjs  --suite ast-bench-v2
node scripts/benchmark-run-batch.mjs --suite ast-bench-v2
node scripts/benchmark-score.mjs    --suite ast-bench-v2
npm run benchmark:bundle:v2
npm run benchmark:ui:test
npm run proof:no-mock
```

### v1 — original focused suite (still present, additive)

The v1 suite (`benchmark/specs/ast-bench-v1.json`) defined 25 tasks across five domains, two lanes, three agents, three repeats, with promotion tiers. The v1 focused run measured a within-agent MongoDB advantage on tokens, cost, time, and retries for the tasks it covered; the captured deltas live in the v1 evidence bundle, not in this prose. Full public-V1 (450 captured lane runs) remains a documented future-scope milestone, and `public-v1` stays blocked until every required cell has captured evidence.

v1 flow (for reference): `npm run benchmark:all`, `npm run proof:all`, `npm run prototype:lab`.

---

## Deploy (marketing page)

```sh
npm run build
```

For Cloudflare Pages Git integration, leave the custom deploy command empty and set the output directory to `prototypes/lab-console`. Or deploy explicitly:

```sh
npx wrangler pages deploy prototypes/lab-console --project-name=llm-friendly-bench
```

`npm run proof:no-mock` is the runtime hard gate: it fails if the seller console ships an unverified artifact, renders placeholder proof states, or promotes evidence without a valid no-mock contract.
