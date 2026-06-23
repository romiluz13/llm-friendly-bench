# AST-Bench: Agent Schema Tax Benchmark

AST-Bench measures which database (MongoDB vs Postgres) is more LLM-friendly when AI coding agents build ordinary application software. Databases are the **subject**; Claude Code and Codex are independent **measuring instruments**. Only within-agent comparisons are valid — cross-agent absolute numbers are never comparable because the two CLIs report tokens differently.

**tokensRead** = `inputTokens + cachedInputTokens` (context tokens the agent had to read, from each CLI's real usage events).

---

## v2 Shape-Diversity MVP (current headline work)

The v2 pilot answers a sharper question: **does MongoDB's advantage grow as the Postgres schema deepens?**

### Design

One shared business outcome (`strategic-account-rescue`) is implemented across three Postgres schema shapes of increasing relational depth:

| Shape    | Tables | Character                                                          |
|----------|--------|--------------------------------------------------------------------|
| Shallow  | 8      | Mostly denormalized onto the request row                           |
| Moderate | 12     | 1-to-many child tables                                             |
| Deep     | 17     | Full 3NF — includes a `contact_x_owner_group` many-to-many junction; 10+ joins to reconstruct state |

MongoDB stays one flat document set across all shapes. One shared acceptance contract per outcome, so any metric difference is attributable to schema shape alone.

Every Postgres shape is **idiomatic best-practice normalization** — the deep shape is what a competent DBA builds, not a strawman.

### Matrix

`3 shapes × 2 lanes (mongo/postgres) × 2 agents (claude-code/codex) × 5 repeats = 60 real runs`

This is a **focused pilot**, not public-V1. Full public-V1 requires 25 tasks × 2 lanes × 3 agents × 3 repeats = **450 captured lane runs** — that bar is a documented limitation and future scope, not the current claim.

### Hypothesis (reported honestly)

Does the MongoDB advantage grow as Postgres normalizes deeper (shallow → moderate → deep)? The marketing page reports `growsWithDepth` from real data. Read the current measured deltas and depth-trend verdict directly from the page — the batch produces the numbers and the bundle is the source of truth.

### Harness integrity

- Acceptance tests are fail-closed: before-state fails by `AssertionError`.
- A cheat detector marks any run that uses `globalThis`/`global` injection as failed.
- Diffs are captured vs a frozen commit; tokens are measured from real CLI transcripts.
- A no-mock gate (`npm run proof:no-mock`) verifies evidence hashes are self-consistent.

### v2 Flow

```sh
node scripts/benchmark-validate.mjs --suite ast-bench-v2
node scripts/benchmark-prepare.mjs --suite ast-bench-v2
node scripts/benchmark-run-batch.mjs --suite ast-bench-v2   # 60 cells
node scripts/benchmark-score.mjs --suite ast-bench-v2
npm run benchmark:bundle:v2
npm run benchmark:ui:test
npm run proof:no-mock
npm run prototype:lab                                         # marketing page at http://127.0.0.1:4173/
```

The v2 marketing page is `prototypes/lab-console/index.html`; it reads `evidence/ast-bench-v2/benchmark-public-bundle.json`. The v1 forensic console is archived at `prototypes/lab-console/console-v1.html`.

### Within-agent-only rule

Only Codex-vs-Codex and Claude Code-vs-Claude Code comparisons are valid. Do not compare absolute token counts across agents. Codex `turn.completed.usage` is cumulative including cache; Claude `result.usage` is final-turn, cache-dominated. The metric **tokensRead** = `inputTokens + cachedInputTokens` normalizes within each agent's own reporting.

---

## Path to Official MongoDB Material

The v2 pilot is credible enough to show leadership. Two steps remain before it becomes officially endorsed MongoDB material:

1. **Independent Postgres-fairness review** — a third party confirms all three Postgres shapes are idiomatic and the deep 3NF design is competent, not adversarial.
2. **MongoDB brand/legal sign-off** — standard review before external publication.

Until both are complete, this is a "disciplined, reproducible pilot," not official MongoDB-endorsed marketing copy.

---

## v1 Suite (still present, additive)

The v1 suite remains valid. It ran 5 tasks × 2 lanes × 2 agents × 3 repeats = 60 runs across five domains, confirming within-agent MongoDB advantage on all four metrics (tokens, cost, time, retries). v2 is additive — it does not replace v1 results but extends the question to schema-depth variation.

### v1 Flow

1. `benchmark/specs/ast-bench-v1.json` — five domains, 25-task spec, MongoDB/Postgres lanes, Codex/Claude Code/Cursor agents, three repeats, promotion tiers.
2. `npm run benchmark:validate` — validates the suite contract.
3. `npm run benchmark:prepare` — creates deterministic frozen workspaces where acceptance starts failing.
4. `npm run benchmark:design-review` — emits the rubric-backed database-native review artifact.
5. `npm run benchmark:run -- --task strategic-account-rescue --lane mongo --agent codex --repeat 1` — one cell. Full V1: `AST_BENCH_RUN_FULL=1 npm run benchmark:run -- --all`.
6. `npm run benchmark:score` — normalizes captured evidence; holds `public-v1` blocked until all 450 cells have captured evidence.
7. `npm run benchmark:bundle` — writes `benchmark/public-bundle.json` and the lab-console copy.
8. `npm run benchmark:gates` — blocks overclaiming and public-v1 promotion without the full proof set.
9. `npm run benchmark:ui:test` — checks the public benchmark UI contract.

### v1 Proof flow (seed replay)

The original Codex seed replay is superseded by the v1 focused benchmark results, but the instrumented proof infrastructure remains:

```sh
npm run proof:all
npm run instrumented:prepare
npm run instrumented:codex:all
npm run proof:verified
npm run proof:no-mock
npm run benchmark:all
npm run prototype:lab
```

### What the benchmark measures

The benchmark compares **databases**, not models. Claude Code and Codex serve as two independent measuring instruments. Only within-agent comparisons are valid:

- Claude Code: MongoDB lane vs Postgres lane
- Codex: MongoDB lane vs Postgres lane

Cross-agent absolute numbers are not comparable. The token metric used is **tokensRead** = input + cached input. Tokens and cost are real measured values from each CLI's usage events, not estimates.

### Benchmark status

- Current v2 MVP: 3 shapes × 2 agents × 5 repeats = **60 real runs**. Read the measured per-shape deltas and depth-trend verdict on the marketing page.
- V1 required lane runs: **450** (25 tasks × 2 lanes × 3 agents × 3 repeats) — this is a future-scope milestone, not the current claim. `public-v1` remains blocked until all required cells have captured evidence.

---

## Commands

```sh
# v2 MVP
npm run benchmark:bundle:v2
npm run benchmark:ui:test
npm run proof:no-mock
npm run prototype:lab

# v1
npm run proof:all
npm run benchmark:all
```

## Cloudflare Deploy

```sh
npm run build
```

For Cloudflare Pages Git integration, leave the custom deploy command empty and set the output directory to:

```sh
prototypes/lab-console
```

Or deploy explicitly:

```sh
npx wrangler pages deploy prototypes/lab-console --project-name=llm-friendly-bench
```

Optional isolated local databases:

```sh
npm run db:up:mongo
npm run proof:mongo:db
npm run proof:all
```

```sh
npm run db:up:postgres
npm run proof:postgres:db
npm run proof:all
```

Full Docker seeding: `npm run db:up` and `npm run db:seed`. MongoDB uses `127.0.0.1:27018`; Postgres uses `127.0.0.1:5433`.

`npm run proof:no-mock` is the runtime hard gate. It fails if the seller console ships an unverified artifact, renders placeholder proof states, or promotes evidence without a valid no-mock contract.
