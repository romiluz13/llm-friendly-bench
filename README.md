# AST-Bench: Agent Schema Tax Benchmark

AST-Bench is the benchmark engine behind MongoDB's AI-era productivity argument: when coding agents build ordinary application software, database shape becomes measurable context cost, elapsed time, retry pressure, review burden, and human supervision.

The current verified replay is **seed case-study evidence**, not the final V1 benchmark. Full public V1 requires 25 tasks x 2 database lanes x 3 coding agents x 3 repeats = **450 captured lane runs**. The public UI and gates refuse to label the work `public-v1` until that evidence exists.

## AST-Bench V1 Flow

1. `benchmark/specs/ast-bench-v1.json` defines five domains, 25 tasks, MongoDB/Postgres lanes, Codex/Claude Code/Cursor agents, three repeats, and promotion tiers.
2. `npm run benchmark:validate` validates the suite contract.
3. `npm run benchmark:prepare` creates deterministic MongoDB-native and Postgres-native target workspaces where acceptance starts failing.
4. `npm run benchmark:design-review` emits the rubric-backed database-native review artifact; independent HITL review is still required before public V1.
5. `npm run benchmark:run -- --task strategic-account-rescue --lane mongo --agent codex --repeat 1` runs one selected cell. Full V1 requires `AST_BENCH_RUN_FULL=1 npm run benchmark:run -- --all`.
6. `npm run benchmark:score` normalizes captured run evidence and keeps the current status below `public-v1` until all required cells pass.
7. `npm run benchmark:bundle` writes `benchmark/public-bundle.json` and the lab-console copy.
8. `npm run benchmark:gates` blocks overclaiming, missing evidence, and public-v1 promotion without the 450-run proof set.
9. `npm run benchmark:ui:test` checks the public benchmark theater contract.

## Current Proof Flow

The seed build still includes a verified Codex replay:

1. `scenarios/customer-order-lifecycle/scenario-definition.json` defines the canonical Scenario Dataset.
2. `scripts/proof-fixtures.mjs` generates database-native projections:
   - `data/generated/mongodb/collections.json`
   - `data/generated/postgres/tables.json`
3. Target Adapters run the same Customer 360 Escalation Workflow:
   - `targets/mongodb-app/src/order-exception-workflow.mjs`
   - `targets/postgres-app/src/order-exception-workflow.mjs`
4. `targets/shared/acceptance.mjs` asserts the same customer-visible outcome.
5. `scripts/run-local-proof.mjs` emits:
   - `data/generated/proof/order-exception-local-proof.json`
   - `data/generated/proof/evidence-manifest.json`
   - `prototypes/lab-console/replays/order-exception-codex-v1-candidate.json`
6. `scripts/prepare-instrumented-run.mjs` creates frozen before-state MongoDB and Postgres workspaces where the same acceptance test initially fails.
7. `scripts/run-instrumented-codex.mjs` runs Codex non-interactively against each workspace and captures raw transcript, diff, tests, portal snapshot, and run metadata.
8. `scripts/score-instrumented-runs.mjs` normalizes comparable live-run metrics.
9. `scripts/promote-verified-replay.mjs` emits `prototypes/lab-console/replays/order-exception-codex-v1-verified.json` only when all gates pass.
10. The Lab Console renders AST-Bench progress plus the verified seed replay at `http://127.0.0.1:4173/`. It no longer falls back to an unverified runtime artifact.

## Commands

```sh
npm run proof:all
npm run instrumented:prepare
npm run instrumented:codex:all
npm run proof:verified
npm run proof:no-mock
npm run benchmark:all
npm run prototype:lab
```

## Cloudflare Deploy

Use this build command:

```sh
npm run build
```

For Cloudflare Pages Git integration, leave the custom deploy command empty and set this output directory in the Cloudflare dashboard:

```sh
prototypes/lab-console
```

If the Cloudflare project has a custom deploy command, use one of these:

```sh
npx wrangler pages deploy prototypes/lab-console --project-name=llm-friendly-bench
```

or:

```sh
npx wrangler deploy
```

The committed `wrangler.toml` is configured for Workers Static Assets because Cloudflare ran `npx wrangler deploy` in the failing log. For Pages, the explicit `wrangler pages deploy` command above is the matching deploy path.

Optional isolated local databases:

```sh
npm run db:up:mongo
npm run proof:mongo:db
npm run proof:all
```

The MongoDB local proof seeds real collections, runs the workflow with `mongosh`, writes `data/generated/proof/mongodb-local-db-proof.json`, and marks the Lab Console evidence as captured.

When the Postgres Docker image is available, run:

```sh
npm run db:up:postgres
npm run proof:postgres:db
npm run proof:all
```

Full Docker seeding is also available with `npm run db:up` and `npm run db:seed`; MongoDB uses `127.0.0.1:27018` and Postgres uses `127.0.0.1:5433` so this does not touch other local services.

`npm run proof:no-mock` is the runtime hard gate. It fails if the seller console ships the retired prototype replay, renders placeholder proof states, or promotes a verified artifact without an explicit no-mock runtime data contract.

## Proof Status

**Focused benchmark — 5 domains, 2 agents, 60 real runs.**

A focused benchmark was run: 5 tasks (one per domain: strategic-account-rescue, split-shipment-exception, sla-breach-route, invoice-dispute-workflow, data-access-audit-export) × 2 database lanes (MongoDB, Postgres) × 3 repeats × 2 coding agents (Claude Code, Codex) = 60 real runs against local Docker MongoDB and Postgres. 59 passed, 0 failed (1 calibration cell reused).

### Harness integrity

Before these runs, the acceptance-test generator had a bug that let an agent "pass" by injecting a global. Tests were fixed to fail-closed and a cheat detector now marks any global-injection run as failed. All 60 runs are verified clean: 0 cheats, real diffs, no test or data edits.

### What this benchmark measures

The benchmark compares **databases**, not models. Claude Code and Codex serve as two independent measuring instruments. Only within-agent comparisons are valid:

- Claude Code: MongoDB lane vs. Postgres lane
- Codex: MongoDB lane vs. Postgres lane

Cross-agent absolute numbers are not comparable. The two CLIs report tokens differently (Codex `turn.completed.usage` is cumulative including cache; Claude `result.usage` is final-turn, cache-dominated). The token metric used is "context tokens read" = input + cached input. Tokens and cost are real measured values from each CLI's usage events, not estimates.

### Results (median across 3 repeats per agent, Postgres vs. MongoDB)

Both agents independently did more work on Postgres for the same tasks:

**Codex (within-agent):**
- +15% context tokens read on Postgres
- +15% cost on Postgres
- +18% elapsed time on Postgres
- +33 retry signals on Postgres

**Claude Code (within-agent):**
- +4% context tokens read on Postgres
- +9% cost on Postgres
- +8% elapsed time on Postgres
- +16 retry signals on Postgres

Agent agreement: both agents favor MongoDB on all four metrics.

### AST-Bench status

- V1 required lane runs: 450 (25 tasks × 2 lanes × 3 agents × 3 repeats).
- Current captured passed lane runs: 60 (focused benchmark, 5 tasks × 2 agents).
- Current public label: `Focused benchmark — 5 domains, 2 agents, 60 real runs`.
- `public-v1` remains blocked until all required task/agent/database/repeat cells have captured evidence.
- The original Codex seed replay (`order-exception-codex-v1-verified`) is superseded by these focused benchmark results.
