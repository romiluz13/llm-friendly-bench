# AST-Bench v2 MVP: Shape-Diversity Proof + Marketing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the MongoDB advantage for AI coding agents **grows with relational depth** by running the same business outcome across 3 genuinely different schema shapes (shallow/moderate/deep) × 2 agents × 5 repeats = 60 real runs, then present it as a marketing-grade, leadership-ready results page.

**Architecture:** Reuse the hardened v1 harness (real-token extractor, cheat detection, frozen-diff capture, within-agent scorer, hash-verifying gates) unchanged. The one structural change is making fixture + workspace generation **shape-parameterized** off a new `shape` field, keeping ONE acceptance contract per outcome so the control holds. Add a trace-highlight extractor and a marketing page over the same bundle data contract. v2 is **additive** — v1 evidence stays intact.

**Tech Stack:** Node.js ESM (no deps), Docker MongoDB (`:27018`) + Postgres (`:5433`), `claude` CLI on Bedrock (`ai-prod-llm`), `codex` CLI, static HTML/CSS/JS console.

## Global Constraints

- **Subject is the database, not the model.** Within-agent comparisons only (Claude-mongo vs Claude-postgres; Codex-mongo vs Codex-postgres). NEVER display or claim cross-agent absolute numbers. Token metric = `tokensRead = inputTokens + cachedInputTokens` (CLIs report tokens incompatibly).
- **Same business outcome across all 3 shapes.** Only schema depth differs. One shared acceptance contract per outcome — any metric difference is attributable to shape alone.
- **The asymmetry IS the finding.** MongoDB document stays flat; Postgres normalizes deeper. Show both lanes' deltas openly, including metrics where MongoDB does not win. Never hide a loss or a null/negative result.
- **Idiomatic Postgres only.** Each Postgres schema must be textbook best-practice normalization (sensible keys/indexes), NOT a strawman. The deep shape = "what a competent DBA would build."
- **Real measured results only.** No synthetic runtime results. Before-state must FAIL by assertion (not ReferenceError) in every shape; a real solution must PASS. Cheat detection (globalThis/global injection) must stay active.
- **No overclaim.** Never label public-v1 (needs 450 runs). Honest scope label: "3 schema shapes × 2 agents × 5 repeats = 60 real runs." Never "guaranteed savings." The 450 bar may appear ONLY in a methodology/limitations section, never the hero.
- **v2 is additive.** Do NOT mutate v1's `ast-bench-v1.json` spec or v1 results. New suite = `ast-bench-v2`.
- **5 benchmark... shapes:** `shallow`, `moderate`, `deep`. **2 agents:** `claude-code`, `codex`. **5 repeats.** **Matrix = 3×2×2×5 = 60 runs.**
- **UI gate is coupled to v1's page;** when reworking the page, update `benchmark-ui-test.mjs` + `check-no-mock-data.mjs` in the SAME commit, preserving fail-closed + no-overclaim assertions.
- **Commit cadence:** small commits on branch `mvp-shape-diversity`. Commit messages end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Never commit secrets. Never commit nested `.git` dirs inside run workspaces.
- **Gates that must stay green:** `npm run build`, `benchmark:validate`, `benchmark:gates`, `benchmark:test-gates`, `benchmark:ui:test`, `proof:no-mock`, plus unit tests.

---

## File Structure

**Harness (scripts/):**
- `scripts/benchmark-lib.mjs` — MODIFY: add `SHAPES`, shape-aware Postgres fixture builders (`buildPostgresFixtureShallow/Moderate/Deep`), keep Mongo flat; `buildTaskFixture(task, lane, shape)`.
- `scripts/benchmark-prepare.mjs` — MODIFY: thread `shape` through `writeWorkspace`; shape-aware `portalView`, `migrationDoc`, `acceptanceTest`; write per-(shape,lane) target dirs.
- `scripts/benchmark-shapes.mjs` — CREATE: the 3 shape definitions (table layouts per shape) + a unit test target.
- `scripts/trace-highlights.mjs` — CREATE: pure extractor of plain-language trace contrasts from transcripts.
- `scripts/test-trace-highlights.mjs` — CREATE: unit test for the extractor.
- `scripts/benchmark-lib.mjs` + `scripts/benchmark-score.mjs` — MODIFY: per-shape within-agent verdict + "advantage-grows-with-depth" summary.
- `scripts/benchmark-build-public-bundle.mjs` — MODIFY: emit `shapeVerdict` + `whyHighlights` + honest `claimLabel`.
- `scripts/benchmark-run-batch.mjs` — MODIFY: iterate shapes × lanes × agents × 5 repeats (v2 suite).

**Spec / targets:**
- `benchmark/specs/ast-bench-v2.json` — CREATE: 3 shapes, shared outcome, 2 agents, 5 repeats.
- `benchmark/targets-v2/<shape>/<lane>/workspace/...` — REGENERATE via prepare.

**Console (prototypes/lab-console/):**
- `prototypes/lab-console/index.html` — MODIFY: marketing page (twin-agent graphs, agreement hero, jargon wiped).
- `scripts/benchmark-ui-test.mjs`, `scripts/check-no-mock-data.mjs` — MODIFY in lockstep with the page.

**Docs:** `README.md`, `docs/seller-demo-script.md`.

---

## Task 1: Define the 3 shapes

**Why first:** Every downstream task keys off the shape definitions. A shape is a Postgres table layout of increasing normalization depth for the SAME data; Mongo is always one flat document set.

**Files:**
- Create: `scripts/benchmark-shapes.mjs`
- Test: `scripts/test-shapes.mjs`

**Interfaces:**
- Produces: `export const SHAPES = ["shallow","moderate","deep"]` and `export function shapeMeta(shape) -> { id, label, postgresTableCount, description, normalization }`.

- [ ] **Step 1: Write the failing test**

`scripts/test-shapes.mjs`:
```js
import assert from "node:assert";
import { SHAPES, shapeMeta } from "./benchmark-shapes.mjs";
assert.deepStrictEqual(SHAPES, ["shallow","moderate","deep"], "three shapes in depth order");
const counts = SHAPES.map((s) => shapeMeta(s).postgresTableCount);
assert(counts[0] < counts[1] && counts[1] < counts[2], "postgres table count strictly increases with depth");
assert(shapeMeta("deep").postgresTableCount >= 10, "deep shape has >=10 tables (10+ joins to reconstruct)");
assert(shapeMeta("shallow").label && shapeMeta("deep").normalization, "meta has label + normalization note");
console.log("shapes ok");
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node scripts/test-shapes.mjs`
Expected: FAIL (cannot find module `./benchmark-shapes.mjs`).

- [ ] **Step 3: Implement `scripts/benchmark-shapes.mjs`**

```js
export const SHAPES = ["shallow", "moderate", "deep"];

const META = {
  shallow: {
    id: "shallow",
    label: "Shallow",
    postgresTableCount: 4,
    normalization: "lightly normalized: workflow request + denormalized account/owner/signal columns",
    description: "Few tables; most state on the request row. Closest to a document."
  },
  moderate: {
    id: "moderate",
    label: "Moderate",
    postgresTableCount: 7,
    normalization: "1-to-many: accounts, contracts, owner-groups, risk-signals split into child tables",
    description: "Realistic CRUD normalization with several joins."
  },
  deep: {
    id: "deep",
    label: "Deep",
    postgresTableCount: 12,
    normalization: "full 3NF incl. a many-to-many junction; 10+ joins to reconstruct product state",
    description: "What a competent DBA builds for a mature system. Heavy reconstruction cost."
  }
};

export function shapeMeta(shape) {
  const meta = META[shape];
  if (!meta) throw new Error(`Unknown shape: ${shape}`);
  return meta;
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `node scripts/test-shapes.mjs`
Expected: `shapes ok`.

- [ ] **Step 5: Commit**

```bash
git add scripts/benchmark-shapes.mjs scripts/test-shapes.mjs
git commit -m "Define 3 benchmark schema shapes (shallow/moderate/deep)"
```

---

## Task 2: Shape-parameterized fixtures (Postgres deepens, Mongo stays flat)

**Why:** This is the structural heart. v1's `buildTaskFixture(task, lane)` ignores shape. Add `shape` so the Postgres projection normalizes deeper per shape while the Mongo document stays flat. The data CONTENT is identical across shapes — only the table decomposition changes — so the same acceptance outcome is reachable in every shape.

**Files:**
- Modify: `scripts/benchmark-lib.mjs` (`buildTaskFixture` at line 195; `buildMongoFixture` 226; `buildPostgresFixture` 288)
- Test: `scripts/test-shape-fixtures.mjs` (create)

**Interfaces:**
- Consumes: `SHAPES`/`shapeMeta` from Task 1.
- Produces: `buildTaskFixture(task, lane, shape)`. Mongo output is shape-independent. Postgres output has table-count matching `shapeMeta(shape).postgresTableCount`.

- [ ] **Step 1: Write the failing test**

`scripts/test-shape-fixtures.mjs`:
```js
import assert from "node:assert";
import { buildTaskFixture } from "./benchmark-lib.mjs";
import { shapeMeta } from "./benchmark-shapes.mjs";
const task = { id: "t", title: "T", primaryEntity: "account", domainId: "d", domainLabel: "D", taskIndex: 0, businessPrompt: "p", expectedOutcome: "o" };

// Mongo identical across shapes (document stays flat)
const m1 = JSON.stringify(buildTaskFixture(task, "mongo", "shallow"));
const m2 = JSON.stringify(buildTaskFixture(task, "mongo", "deep"));
assert.strictEqual(m1, m2, "mongo fixture is shape-independent");

// Postgres table count grows with depth
for (const s of ["shallow","moderate","deep"]) {
  const pg = buildTaskFixture(task, "postgres", s);
  const tableCount = Object.keys(pg).length;
  assert.strictEqual(tableCount, shapeMeta(s).postgresTableCount, `${s} postgres has ${shapeMeta(s).postgresTableCount} tables, got ${tableCount}`);
}
// Deep must include a many-to-many junction table (heavy join signal)
const deep = buildTaskFixture(task, "postgres", "deep");
assert(Object.keys(deep).some((t) => /_x_|_link|_membership|junction/.test(t)), "deep has a junction table");
console.log("shape fixtures ok");
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node scripts/test-shape-fixtures.mjs`
Expected: FAIL (`buildTaskFixture` arity / table count mismatch).

- [ ] **Step 3: Implement shape-aware builders**

In `scripts/benchmark-lib.mjs`, import shapes at top: `import { shapeMeta } from "./benchmark-shapes.mjs";`. Change `buildTaskFixture(task, lane)` to `buildTaskFixture(task, lane, shape = "moderate")`. Keep `buildMongoFixture(base)` unchanged and shape-independent. Replace the single `buildPostgresFixture` with a dispatcher:
```js
  if (lane === "mongo") return buildMongoFixture(base);
  return buildPostgresFixtureForShape(base, shape);
```
Add (the deep shape extends moderate with split-out `account_addresses`, `support_plans`, `invoice_risk`, and a `contact_x_owner_group` junction; shallow collapses children back onto the request row):
```js
function buildPostgresFixtureForShape(base, shape) {
  const moderate = buildPostgresFixture(base); // v1's existing 7-table normalized output
  if (shape === "moderate") return moderate;
  if (shape === "shallow") {
    // Collapse children back onto the request row -> 4 tables: fixture, accounts, workflow_requests(+denormalized), workflow_state
    return {
      benchmark_fixture: moderate.benchmark_fixture,
      accounts: moderate.accounts.map((a) => ({ ...a, contract_id: moderate.account_contracts[0]?.contract_id, support_plan: moderate.account_contracts[0]?.support_plan })),
      workflow_requests: moderate.workflow_requests.map((r) => ({
        ...r,
        owner_groups: moderate.workflow_request_owner_groups.map((g) => g.owner_group).join("|"),
        risk_signals: moderate.workflow_request_risk_signals.map((s) => `${s.signal_name}:${s.detail}`).join("|")
      })),
      workflow_state: moderate.workflow_state
    };
  }
  // deep: moderate + further normalization + a junction table => 12 tables
  return {
    ...moderate,
    account_addresses: moderate.accounts.map((a) => ({ address_id: `addr-${a.account_id}`, account_id: a.account_id, region: a.region, kind: "billing" })),
    support_plans: moderate.account_contracts.map((c) => ({ support_plan_id: `sp-${c.contract_id}`, contract_id: c.contract_id, plan: c.support_plan })),
    invoice_risk: moderate.accounts.map((a) => ({ invoice_risk_id: `ir-${a.account_id}`, account_id: a.account_id, level: "medium" })),
    contact_x_owner_group: moderate.contacts.flatMap((c) => moderate.workflow_request_owner_groups.map((g) => ({ contact_id: c.contact_id, request_id: g.request_id, owner_group: g.owner_group }))),
    activity_sources: moderate.activities.map((act) => ({ activity_source_id: `as-${act.activity_id}`, activity_id: act.activity_id, source: "system" }))
  };
}
```
(Counts: shallow = 4, moderate = 7 — verify v1's `buildPostgresFixture` returns exactly 7 keys; if it returns a different count, adjust `shapeMeta("moderate").postgresTableCount` in Task 1 to match the real count — the test must reflect reality, not the other way around. deep = moderate 7 + 5 new = 12.)

- [ ] **Step 4: Run it, verify it passes**

Run: `node scripts/test-shape-fixtures.mjs`
Expected: `shape fixtures ok`. (If table counts differ, reconcile `shapeMeta` counts to the real `buildPostgresFixture` output and re-run.)

- [ ] **Step 5: Commit**

```bash
git add scripts/benchmark-lib.mjs scripts/test-shape-fixtures.mjs scripts/benchmark-shapes.mjs
git commit -m "Shape-parameterize Postgres fixtures; Mongo document stays flat across shapes"
```

---

## Task 3: Shape-aware portal-view + ONE shared acceptance contract

**Why:** The agent reads the native shape but must produce the SAME customer-visible outcome. The acceptance test asserts the same outcome for every shape; only `buildPortalView` differs per (lane, shape) because it reads a different table layout. This keeps the control: same outcome, different reconstruction cost.

**Files:**
- Modify: `scripts/benchmark-prepare.mjs` (`portalView` at 180; `acceptanceTest` at 229; `writeWorkspace` at 40)
- Test: regen + direct `node tests/acceptance.test.mjs` per shape

**Interfaces:**
- Consumes: `buildTaskFixture(task, lane, shape)` from Task 2.
- Produces: `writeWorkspace({ suite, task, lane, shape, workspace })`; `portalView({ lane, shape, dataFile })`; `acceptanceTest({ task, lane, shape, dataFile })`. Before-state fails by AssertionError in every (lane, shape).

- [ ] **Step 1: Thread `shape` through `writeWorkspace` and generators**

In `benchmark-prepare.mjs`, change `writeWorkspace({ suite, task, lane, workspace })` to accept `shape`, pass `shape` into `buildTaskFixture(task, lane, shape)` (line 41), and into `portalView`, `migrationDoc`, `acceptanceTest`. Make `portalView({ lane, shape })` return a shape-correct reader: shallow Postgres reads denormalized columns (`workflow_requests[0].owner_groups.split("|")`), moderate uses v1's join logic, deep joins through the new child + junction tables. Mongo `portalView` is unchanged for all shapes. The acceptance `expectedOwners`/`expectedSignals` must still resolve from `data` (the Task-1-of-v1 fix) per shape's actual layout.

- [ ] **Step 2: Regenerate one shape triple and verify before-state FAILS by assertion**

```bash
node scripts/benchmark-prepare.mjs --suite ast-bench-v2 --shape deep --lane postgres --task <task>
node benchmark/targets-v2/deep/postgres/workspace/tests/acceptance.test.mjs 2>&1 | grep -iE "AssertionError|ReferenceError" | head -1
```
Expected: `AssertionError` (NOT ReferenceError) — proves the test runs and the before-state legitimately fails. (Note: this task depends on Task 4 wiring the `--suite/--shape` flags; if running standalone, temporarily hardcode the shape to verify generator output, then revert.)

- [ ] **Step 3: Verify a real solution PASSES on the deep shape**

Hand-write a minimal `src/workflow.mjs` that reconstructs state across the deep tables and persists the outcome; run the test; expect `AST-Bench acceptance passed`. Delete the hand solution after (the target ships with the stub). This proves the deep shape is solvable.

- [ ] **Step 4: Commit**

```bash
git add scripts/benchmark-prepare.mjs
git commit -m "Shape-aware portal-view with one shared acceptance contract per outcome"
```

---

## Task 4: v2 suite spec + prepare wiring

**Why:** A v2 suite defines the matrix (3 shapes, shared outcome, 2 agents, 5 repeats) without touching v1. Prepare/run/score read the suite.

**Files:**
- Create: `benchmark/specs/ast-bench-v2.json`
- Modify: `scripts/benchmark-prepare.mjs` (arg parsing + target path), `scripts/benchmark-lib.mjs` (`targetDir`/`runDir` to include shape + suite-aware paths)

**Interfaces:**
- Produces: a suite with `suiteId: "ast-bench-v2"`, `shapes: ["shallow","moderate","deep"]`, `agents: ["claude-code","codex"]`, `repeatsPerCell: 5`, one shared `outcome` task, `requiredLaneRuns: 60`. `targetWorkspacePathV2(shape, lane)` and `runDirV2({shape, lane, agentId, repeat})`.

- [ ] **Step 1: Write the v2 suite spec**

Create `benchmark/specs/ast-bench-v2.json` with one shared business outcome (reuse `strategic-account-rescue`'s prompt/outcome), `shapes`, 2 agents, `repeatsPerCell: 5`, `requiredLaneRuns: 60`, and the v1 `fairnessRules` plus one new rule: `"Postgres schema must be idiomatic best-practice normalization, not a strawman."`

- [ ] **Step 2: Add a validator check**

Run: `node scripts/benchmark-validate.mjs --suite ast-bench-v2` (extend validate to accept `--suite`; default stays v1).
Expected: passes; prints 3 shapes × 2 lanes × 2 agents × 5 repeats = 60 required runs.

- [ ] **Step 3: Wire prepare to generate all v2 targets**

`node scripts/benchmark-prepare.mjs --suite ast-bench-v2` generates `benchmark/targets-v2/<shape>/<lane>/workspace` for all 3 shapes × 2 lanes (6 target dirs).
Verify all 6 before-states fail by AssertionError:
```bash
for s in shallow moderate deep; do for l in mongo postgres; do echo -n "$s/$l: "; node benchmark/targets-v2/$s/$l/workspace/tests/acceptance.test.mjs 2>&1 | grep -oiE "AssertionError|ReferenceError" | head -1; done; done
```
Expected: all six print `AssertionError`.

- [ ] **Step 4: Commit**

```bash
git add benchmark/specs/ast-bench-v2.json scripts/benchmark-prepare.mjs scripts/benchmark-lib.mjs benchmark/targets-v2
git commit -m "Add ast-bench-v2 suite (3 shapes, shared outcome, 5 repeats) and generate targets"
```

---

## Task 5: Run adapter + batch for v2

**Why:** Reuse `benchmark-run.mjs`'s agent execution + cheat detection + frozen-diff; point it at v2 targets/shapes. Batch runs the 60-cell matrix, resumable.

**Files:**
- Modify: `scripts/benchmark-run.mjs` (accept `--suite ast-bench-v2 --shape <s>`; use v2 target/run paths), `scripts/benchmark-run-batch.mjs` (iterate shapes × lanes × agents × 5 repeats)

**Interfaces:**
- Consumes: v2 targets (Task 4), `detectCheatSignals`, `extractUsage`, frozen-diff (all v1, unchanged).
- Produces: `benchmark/runs-v2/ast-bench-v2/<shape>/<agent>/repeat-<n>/<lane>/run-manifest.json` with the same metrics shape as v1 (incl. `tokens`, `cheatSignals`).

- [ ] **Step 1: Calibration run (deep shape, both agents, mongo+postgres)**

```bash
aws sts get-caller-identity --profile ai-prod-llm >/dev/null && echo "SSO ok"
node scripts/benchmark-run.mjs --suite ast-bench-v2 --shape deep --task <outcome> --lane postgres --agent claude-code --repeat 1
node scripts/benchmark-run.mjs --suite ast-bench-v2 --shape deep --task <outcome> --lane mongo --agent codex --repeat 1
```
Inspect both manifests: `status passed`, `tokens.source "measured"`, `cheatSignals []`, non-empty `changedFiles`.
> **CHECKPOINT (report to user):** deep shape solvable by both agents? per-run time? If the deep shape can't pass, surface honestly — do not loosen the test.

- [ ] **Step 2: Update batch runner for the v2 matrix**

Edit `scripts/benchmark-run-batch.mjs`: `SHAPES=["shallow","moderate","deep"]`, `LANES=["mongo","postgres"]`, `AGENTS=["claude-code","codex"]`, `REPEATS=[1,2,3,4,5]`, suite `ast-bench-v2`; skip cells whose manifest exists; log to `benchmark/runs-v2/batch-log.json`.
Dry-verify cell count = 60: `node -e "console.log(3*2*2*5)"` → 60.

- [ ] **Step 3: Launch the batch (controller runs in background)**

The controller launches `node scripts/benchmark-run-batch.mjs` in the background (~4-5h at v1 timing). Monitor `benchmark/runs-v2/batch-log.json`.
> **CHECKPOINT (report to user):** when done — passed/failed/exempt per shape per agent; especially whether the deep shape shows the largest gap.

- [ ] **Step 4: Commit the runner (artifacts committed after the batch, .git dirs stripped)**

```bash
git add scripts/benchmark-run.mjs scripts/benchmark-run-batch.mjs
git commit -m "Run adapter + batch for ast-bench-v2 shape matrix (60 cells)"
```

---

## Task 6: Per-shape within-agent scoring + does-advantage-grow-with-depth

**Why:** The core MVP question: does the MongoDB advantage GROW from shallow → moderate → deep? Compute per-shape within-agent deltas and a depth-trend summary.

**Files:**
- Modify: `scripts/benchmark-score.mjs` (add `computeShapeVerdict(runs)`)
- Test: `scripts/test-shape-verdict.mjs` (create)

**Interfaces:**
- Consumes: v2 run manifests, existing `median`, `computeDatabaseVerdict`.
- Produces: `computeShapeVerdict(runs) -> { perShape: [{ shape, perAgent:[{agentId, deltas:{tokensReadPct,costPct,timePct,retries}, mongoWins}] }], depthTrend: { tokensReadPctByShape: {shallow,moderate,deep}, growsWithDepth: bool }, caveat }`.

- [ ] **Step 1: Write the failing test**

`scripts/test-shape-verdict.mjs`:
```js
import assert from "node:assert";
import { computeShapeVerdict } from "./benchmark-score.mjs";
const mk = (shape, agentId, lane, read) => ({ shape, agentId, lane, status:"passed", metrics:{ cheatSignals:[], tokens:{ tokensRead:read, costUsd:read/1e4 }, elapsedMs:read*10, retrySignals:Math.round(read/1e4) } });
// gap widens with depth for both agents
const runs = [];
for (const ag of ["codex","claude-code"]) {
  runs.push(mk("shallow",ag,"mongo",1000), mk("shallow",ag,"postgres",1030));   // +3%
  runs.push(mk("moderate",ag,"mongo",1000), mk("moderate",ag,"postgres",1150)); // +15%
  runs.push(mk("deep",ag,"mongo",1000), mk("deep",ag,"postgres",1400));         // +40%
}
const v = computeShapeVerdict(runs);
assert.strictEqual(v.perShape.length, 3, "three shapes");
assert(v.depthTrend.growsWithDepth === true, "advantage grows with depth");
assert(v.depthTrend.tokensReadPctByShape.deep > v.depthTrend.tokensReadPctByShape.shallow, "deep gap > shallow gap");
console.log("shape verdict ok");
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node scripts/test-shape-verdict.mjs`
Expected: FAIL (`computeShapeVerdict is not a function`).

- [ ] **Step 3: Implement and export `computeShapeVerdict`**

In `benchmark-score.mjs`, add (reuse the `tokensRead` accessor + `median` from existing code):
```js
export function computeShapeVerdict(runs) {
  const SHAPES = ["shallow", "moderate", "deep"];
  const passed = runs.filter((r) => r.status === "passed" && Array.isArray(r.metrics?.cheatSignals) && r.metrics.cheatSignals.length === 0);
  const tok = (r) => { const t = r.metrics.tokens || {}; return (t.tokensRead != null) ? t.tokensRead : ((t.inputTokens||0)+(t.cachedInputTokens||0)) || 0; };
  const pct = (a, b) => (a > 0 ? Math.round(((b - a) / a) * 100) : 0);
  const perShape = SHAPES.map((shape) => {
    const agents = [...new Set(passed.filter((r) => r.shape === shape).map((r) => r.agentId))];
    const perAgent = agents.map((agentId) => {
      const lane = (id) => passed.filter((r) => r.shape === shape && r.agentId === agentId && r.lane === id);
      const m = lane("mongo"), p = lane("postgres");
      const mTok = median(m.map(tok)), pTok = median(p.map(tok));
      return {
        agentId,
        deltas: {
          tokensReadPct: pct(mTok, pTok),
          costPct: pct(median(m.map((r)=>r.metrics.tokens?.costUsd??0)), median(p.map((r)=>r.metrics.tokens?.costUsd??0))),
          timePct: pct(median(m.map((r)=>r.metrics.elapsedMs)), median(p.map((r)=>r.metrics.elapsedMs))),
          retries: median(p.map((r)=>r.metrics.retrySignals)) - median(m.map((r)=>r.metrics.retrySignals))
        },
        mongoWins: mTok > 0 && pTok > mTok
      };
    });
    return { shape, perAgent };
  });
  const avgPct = (shape) => {
    const rows = perShape.find((s) => s.shape === shape)?.perAgent || [];
    return rows.length ? Math.round(rows.reduce((a, r) => a + r.deltas.tokensReadPct, 0) / rows.length) : 0;
  };
  const byShape = { shallow: avgPct("shallow"), moderate: avgPct("moderate"), deep: avgPct("deep") };
  return {
    perShape,
    depthTrend: { tokensReadPctByShape: byShape, growsWithDepth: byShape.deep > byShape.moderate && byShape.moderate >= byShape.shallow },
    caveat: "Within-agent comparison only. Same business outcome across all shapes; only Postgres relational depth differs."
  };
}
```
Add `shapeVerdict: computeShapeVerdict(capturedRunsV2)` to the v2 summary path. (When scoring v2, read v2 manifests; keep v1 scoring untouched.)

- [ ] **Step 4: Run it, verify it passes**

Run: `node scripts/test-shape-verdict.mjs`
Expected: `shape verdict ok`.

- [ ] **Step 5: Commit**

```bash
git add scripts/benchmark-score.mjs scripts/test-shape-verdict.mjs
git commit -m "Score per-shape within-agent deltas and depth-trend (advantage grows with depth)"
```

---

## Task 7: Trace-highlight extractor

**Why:** The "why" panel. Parse real transcripts to surface the contrast (tables inspected, JOINs written, FK errors vs single document read). Counts from real traces; never hand-written.

**Files:**
- Create: `scripts/trace-highlights.mjs`, `scripts/test-trace-highlights.mjs`

**Interfaces:**
- Produces: `extractHighlights(lane, transcriptText) -> { tablesInspected, joinsWritten, fkErrors, documentReads, summary }`. `summary` is plain-language; returns `{ summary: "trace highlight unavailable", ... zeros }` on empty input (fail honest, never invents).

- [ ] **Step 1: Write the failing test**

`scripts/test-trace-highlights.mjs`:
```js
import assert from "node:assert";
import { extractHighlights } from "./trace-highlights.mjs";
const pg = "ran psql -c '\\d accounts' then SELECT ... JOIN contacts JOIN owner_groups; ERROR: foreign key violation; JOIN risk_signals";
const h = extractHighlights("postgres", pg);
assert(h.joinsWritten >= 2, `counts JOINs, got ${h.joinsWritten}`);
assert(h.fkErrors >= 1, "counts FK errors");
assert(/JOIN|table/i.test(h.summary), "summary mentions joins/tables");
const empty = extractHighlights("postgres", "");
assert(empty.summary === "trace highlight unavailable", "fails honest on empty");
console.log("trace highlights ok");
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node scripts/test-trace-highlights.mjs`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `scripts/trace-highlights.mjs`**

```js
export function extractHighlights(lane, transcriptText) {
  const text = String(transcriptText || "");
  if (!text.trim()) return { tablesInspected: 0, joinsWritten: 0, fkErrors: 0, documentReads: 0, summary: "trace highlight unavailable" };
  const joinsWritten = (text.match(/\bJOIN\b/gi) || []).length;
  const fkErrors = (text.match(/foreign key|fk violation|violates foreign key/gi) || []).length;
  const tablesInspected = new Set((text.match(/\\d\s+(\w+)/g) || []).map((s) => s.trim())).size
    + (text.match(/\bFROM\s+(\w+)/gi) || []).length;
  const documentReads = (text.match(/findOne|find\(|collection\(|\.aggregate\(/gi) || []).length;
  const summary = lane === "postgres"
    ? `Agent inspected ~${tablesInspected} tables, wrote ${joinsWritten} JOINs${fkErrors ? `, hit ${fkErrors} FK errors` : ""}.`
    : `Agent read the document directly (${documentReads || 1} read${documentReads === 1 ? "" : "s"}), no joins.`;
  return { tablesInspected, joinsWritten, fkErrors, documentReads, summary };
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `node scripts/test-trace-highlights.mjs`
Expected: `trace highlights ok`.

- [ ] **Step 5: Commit**

```bash
git add scripts/trace-highlights.mjs scripts/test-trace-highlights.mjs
git commit -m "Add auto-extracted trace-highlight extractor for the why-panel"
```

---

## Task 8: Surface shape verdict + why-highlights + honest label in the bundle

**Why:** The marketing page reads the bundle. It needs `shapeVerdict`, per-shape `whyHighlights` (from real transcripts via Task 7), and the honest `claimLabel`.

**Files:**
- Modify: `scripts/benchmark-build-public-bundle.mjs`

**Interfaces:**
- Consumes: `shapeVerdict` (Task 6), `extractHighlights` (Task 7), v2 run transcripts.
- Produces: bundle fields `shapeVerdict`, `whyHighlights: [{ shape, mongo:{summary}, postgres:{summary} }]`, `claimLabel: "3 schema shapes × 2 agents × 5 repeats = 60 real runs"`, `claimScope`.

- [ ] **Step 1: Add fields to the bundle**

In `benchmark-build-public-bundle.mjs` (v2 path), add `shapeVerdict: result.shapeVerdict`, build `whyHighlights` by reading each shape's mongo+postgres transcript and calling `extractHighlights`, and set the honest `claimLabel`/`claimScope`. Keep gate-required fields (`currentSeed.caveat`, `evidenceClaims` ≥6 with valid sha256, `progress.requiredLaneRuns`).

- [ ] **Step 2: Rebuild + verify gates**

```bash
node scripts/benchmark-score.mjs && node scripts/benchmark-build-public-bundle.mjs
node -e "const b=require('./benchmark/public-bundle.json'); console.log(!!b.shapeVerdict, b.claimLabel, b.whyHighlights?.length)"
npm run benchmark:gates && npm run benchmark:test-gates && npm run proof:no-mock
```
Expected: shapeVerdict present, claimLabel correct, 3 whyHighlights; all gates pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/benchmark-build-public-bundle.mjs benchmark/public-bundle.json prototypes/lab-console/evidence/ast-bench-v1/benchmark-public-bundle.json
git commit -m "Expose shape verdict, why-highlights, and honest claim label in bundle"
```

---

## Task 9: Marketing-grade results page (twin-agent graphs, agreement hero, jargon wiped)

**Why:** The user's core ask. Audience = leadership/sales. Internal jargon out, real numbers + animated graphs + motion in, forensic rigor one click down.

**Files:**
- Modify: `prototypes/lab-console/index.html`, and `scripts/benchmark-ui-test.mjs` + `scripts/check-no-mock-data.mjs` in lockstep.

**Interfaces:**
- Consumes: `shapeVerdict`, `whyHighlights`, `databaseVerdict`, `claimLabel` from the bundle.
- Produces: agreement-first hero; twin agent cards each with an animated 4-metric bar-graph; below-fold 3-shape depth story + why-panel + methodology/evidence.

- [ ] **Step 1: Update the UI gate to the NEW contract first (TDD for UI)**

Edit `benchmark-ui-test.mjs` + `check-no-mock-data.mjs`: replace v1-specific required copy ("Agent Schema Tax", "Proof mode", "MongoDB made the AI do less database work.", the seed-receipt internals) with the NEW required surface: hero copy "did measurably less work on MongoDB", twin-agent graph containers (e.g. ids `agent-graph-codex`, `agent-graph-claude-code`), `shape-story`, `why-panel`, `claim-label`, and an `inspect-evidence` control. KEEP the no-overclaim assertions (no "guaranteed savings", no public-v1, 450 only in methodology) and fail-closed behavior. Run `npm run benchmark:ui:test` → it should now FAIL against the current v1 page (proving the gate drives the rework).

- [ ] **Step 2: Rework the page to satisfy the new gate**

Rewrite the hero + add `renderAgentGraphs(bundle)` (twin cards, each an animated SVG/div bar-graph of the 4 within-agent deltas, MongoDB green vs neutral Postgres, "lower = better", `prefers-reduced-motion` honored), `renderShapeStory(bundle)` (3 shapes, gap widening), `renderWhyPanel(bundle)` (from `whyHighlights`). Move all forensic/evidence content behind an "Inspect the evidence" control. Remove v1 internal-jargon copy from the primary view. Every `<button>` keeps a data-claim/id binding.

- [ ] **Step 3: Gates + REAL browser smoke (mandatory)**

```bash
npm run benchmark:ui:test && npm run proof:no-mock && npm run benchmark:gates
npm run prototype:lab   # serve, then render in headless Chrome
```
Render `http://127.0.0.1:4173/` in a real browser (headless Chrome `--dump-dom` + `--screenshot`); confirm: no JS console errors, hero shows agreement claim, BOTH agent graphs render and animate, shape story + why-panel present, "Inspect the evidence" reveals the proof layer, no internal jargon visible. Review the screenshot.

- [ ] **Step 4: Commit**

```bash
git add prototypes/lab-console/index.html scripts/benchmark-ui-test.mjs scripts/check-no-mock-data.mjs
git commit -m "Marketing results page: twin-agent graphs, agreement hero, internal jargon removed"
```

---

## Task 10: Docs + final full verification

**Why:** README/demo-script must describe the shape-diversity proof honestly; then run every gate and a final browser smoke.

**Files:**
- Modify: `README.md`, `docs/seller-demo-script.md`

- [ ] **Step 1: Update docs**

Describe: 3 shapes (shallow/moderate/deep), same outcome, idiomatic Postgres, within-agent only, real tokens/cost, the depth-trend finding (whichever way it lands — report honestly), honest scope label, 450 only as a limitation. Add the "independent fairness review + brand/legal" steps as the documented path to *official* MongoDB material.

- [ ] **Step 2: Commit the 60 run artifacts (strip nested .git first)**

```bash
find benchmark/runs-v2 -path "*/workspace/.git" -type d -exec rm -rf {} + 2>/dev/null
git add benchmark/runs-v2 benchmark/results/ benchmark/public-bundle.json prototypes/lab-console/evidence/ast-bench-v1/benchmark-public-bundle.json
git status --cached --name-only | grep -cE "\.git/|node_modules" # must be 0
git commit -m "Capture 60 real shape-diversity runs (3 shapes x 2 agents x 5 repeats)"
```

- [ ] **Step 3: Full gate suite + integrity sweep**

```bash
npm run build && npm run benchmark:validate && npm run benchmark:gates && npm run benchmark:test-gates && npm run benchmark:ui:test && npm run proof:no-mock
node scripts/test-shapes.mjs && node scripts/test-shape-fixtures.mjs && node scripts/test-shape-verdict.mjs && node scripts/test-trace-highlights.mjs && node scripts/test-agent-usage.mjs && node scripts/test-database-verdict.mjs
```
Expected: all exit 0. Integrity-sweep the 60 v2 manifests (0 cheats, real diffs, tokens measured, no test/data edits) and confirm evidence hashes are self-consistent (committed bundle hash matches committed files).

- [ ] **Step 4: Final browser smoke + report to user**

Re-render the page in a real browser; confirm the shipped story matches the data (esp. the depth trend). Commit docs. Report: per-shape deltas, whether the advantage grew with depth, any exempt cell, and the deploy path.

```bash
git add README.md docs/seller-demo-script.md
git commit -m "Document shape-diversity MVP and path to official material"
```

---

## Self-Review (completed inline)

- **Spec coverage:** 3 shapes (T1,T2), same outcome/one acceptance contract (T3), v2 suite additive (T4), 60 runs/5 repeats (T4,T5), per-shape + depth-trend scoring (T6), why-panel from real traces (T7,T8), honest claim label (T8), marketing page with twin-agent graphs + jargon wiped + gate-in-lockstep (T9), docs + final verify + integrity + browser smoke (T10). Fairness (idiomatic Postgres) is a Global Constraint + T4 rule + T3 deep-solvable proof.
- **Placeholder scan:** none — every code/test step has real code; `<task>`/`<outcome>` refer to the single shared outcome task id defined in T4's spec (the implementer picks the one id from `ast-bench-v2.json`). Flagged the one reconciliation point (moderate table count) with explicit instruction to match reality.
- **Type consistency:** `buildTaskFixture(task, lane, shape)` consistent T2→T3→T4; `shapeMeta` shape T1→T2; `computeShapeVerdict` shape T6→T8→T9; `extractHighlights` shape T7→T8→T9; `tokensRead` accessor consistent with v1.
- **Risk:** if the advantage does NOT grow with depth, T6/T10 report it honestly (the benchmark's value is falsifiability) — the plan never assumes the result.
