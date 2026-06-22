# Claude Code MongoDB-vs-Postgres Benchmark + Ship-Ready Console — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a real, reproducible benchmark of *which database (MongoDB vs Postgres) is more LLM-friendly*, measured by two independent coding agents (Claude Code + Codex), and present it in a calm, ship-ready console that a non-technical and a technical viewer both trust in the first minute.

**Architecture:** Fix the gameable benchmark harness first (broken target tests + missing real-token capture), regenerate clean targets, discard tainted evidence, then generate real runs in the background, score them as **within-agent deltas only**, and rework the existing single-file console to lead with the measured database answer while preserving its fail-closed evidence discipline.

**Tech Stack:** Node.js ESM scripts (no deps), Docker MongoDB (`:27018`) + Postgres (`:5433`), `claude` CLI 2.1.186 on Bedrock (`ai-prod-llm`), `codex` CLI 0.130.0, static HTML/CSS/JS console served by `python3 -m http.server`.

## Global Constraints

- **Subject is the database, not the model.** Only **within-agent** comparisons are valid: Claude(mongo) vs Claude(postgres); Codex(mongo) vs Codex(postgres). **Never** display or claim cross-agent numbers (no "Claude used fewer tokens than Codex").
- **Real measured results only.** Headline tokens/cost/time come from real CLI `usage` events. `bytes/4` is allowed **only** as an explicitly-labeled fallback when a CLI emits no usage.
- **No synthetic runtime results.** Synthetic fixtures are allowed; fabricated run metrics are never allowed.
- **No overclaim.** Never label `public-v1` (needs the full 450-run, 3-agent, 25-task matrix). Public label stays `case-study`/`pilot`. Never say "guaranteed savings." Keep the 450-run bar visible.
- **Fail closed.** If verified evidence is missing, the console must refuse to render rather than show an unverified fallback.
- **Mixed metrics stay visible.** A MongoDB loss on any single metric (e.g. larger diff) is shown, not hidden. Failed/exempt cells are shown, never silently dropped.
- **Commit cadence:** small commits per task on branch `claude-code-db-benchmark`. Never commit secrets. No force-push/reset without explicit ask.
- **5 benchmark tasks (one per domain):** `strategic-account-rescue`, `split-shipment-exception`, `sla-breach-route`, `invoice-dispute-workflow`, `data-access-audit-export`.
- **Verification gates that must stay green:** `npm run benchmark:validate`, `benchmark:score`, `benchmark:gates`, `benchmark:test-gates`, `benchmark:ui:test`, `proof:no-mock`, `npm run build`.

---

## File Structure

**Harness (scripts/):**
- `scripts/benchmark-prepare.mjs` — MODIFY: fix the generator so mongo/postgres acceptance tests reference the real top-level variable (`data`), not undefined `db`/`tables`. Add a guard rejecting `globalThis`/`global.` writes in accepted solutions.
- `scripts/agent-usage.mjs` — CREATE: pure functions that extract **real** token usage + cost from Codex and Claude Code transcripts; deterministic, unit-testable.
- `scripts/test-agent-usage.mjs` — CREATE: unit tests for the extractor against captured fixtures.
- `scripts/run-instrumented-codex.mjs` and `scripts/benchmark-run.mjs` — MODIFY: fix Claude adapter flags (`--verbose`), wire real usage into manifest `metrics`, add `globalThis` cheat detection to run status.
- `scripts/benchmark-run-batch.mjs` — CREATE: resumable background batch runner for the 60-cell matrix.
- `scripts/benchmark-score.mjs` — MODIFY: compute per-agent within-lane medians + spread from real tokens; add agent-agreement block; stop counting the tainted seed/`globalThis` runs.
- `scripts/benchmark-build-public-bundle.mjs` — MODIFY: emit a `databaseVerdict` block (within-agent deltas, agent agreement) for the console.

**Targets (regenerated):**
- `benchmark/targets/<task>/<lane>/workspace/...` — REGENERATE all via fixed prepare.

**Console (prototypes/lab-console/):**
- `prototypes/lab-console/index.html` — MODIFY: rework first viewport to lead with the database verdict + agent-agreement; keep required IDs/functions/copy the gates assert.
- `scripts/benchmark-ui-test.mjs` and `scripts/check-no-mock-data.mjs` — MODIFY only if the rework intentionally changes a required token; keep them as the contract.

**Docs:**
- `README.md`, `docs/seller-demo-script.md` — MODIFY: reflect real Claude+Codex DB benchmark, retire Codex-only framing, keep honest caveats.

---

## Task 1: Fix the gameable acceptance-test generator

**Why first:** Verified 2026-06-23 — all 50 target tests reference an undefined top-level `db`/`tables` and throw `ReferenceError`. The only recorded "passed" run passed solely because the agent wrote `globalThis.db = db;` to satisfy the broken test. The benchmark is currently gameable; every downstream number depends on this fix.

**Files:**
- Modify: `scripts/benchmark-prepare.mjs:230-235` (the `expectedOwners`/`expectedSignals` emission in `acceptanceTest`)
- Test: manual target regen + direct `node tests/acceptance.test.mjs`

**Interfaces:**
- Produces: regenerated target workspaces whose `tests/acceptance.test.mjs` references `data.workflow_requests[0]` (mongo) / a `data`-rooted expression (postgres) at top level; before-state fails by `AssertionError`, real solution passes.

- [ ] **Step 1: Write the failing check (target test must not throw ReferenceError)**

Run, before any change, to capture current broken behavior:
```bash
cd /Users/rom.iluz/Dev/sql-hidden-cost
node benchmark/targets/strategic-account-rescue/mongo/workspace/tests/acceptance.test.mjs 2>&1 | tail -3
```
Expected now: `ReferenceError: db is not defined`.

- [ ] **Step 2: Fix the generator**

In `scripts/benchmark-prepare.mjs`, change the `acceptanceTest` expected-value expressions (currently lines 230-235) from the undefined globals to the real top-level `data` variable:

```js
  const expectedOwners = lane === "mongo"
    ? "data.workflow_requests[0].ownerGroups"
    : "data.workflow_request_owner_groups.slice().sort((a, b) => a.group_order - b.group_order).map((item) => item.owner_group)";
  const expectedSignals = lane === "mongo"
    ? "data.workflow_requests[0].riskSignals"
    : "data.workflow_request_risk_signals.slice().sort((a, b) => a.signal_order - b.signal_order).map((item) => ({ name: item.signal_name, detail: item.detail }))";
```

(Note: `.slice()` added so the sort does not mutate the source fixture, and `tables.` replaced by the actual top-level name `data`.)

- [ ] **Step 3: Regenerate all targets**

```bash
node scripts/benchmark-prepare.mjs
```
Expected: regenerates `benchmark/targets/*/{mongo,postgres}/workspace`. (If the script requires per-task invocation, loop the 5 plan tasks × 2 lanes; confirm by reading its `--task`/`--lane` handling first.)

- [ ] **Step 4: Verify before-state FAILS by assertion (not ReferenceError) and a real solution PASSES**

```bash
# before-state (stub) must fail by AssertionError:
node benchmark/targets/strategic-account-rescue/mongo/workspace/tests/acceptance.test.mjs 2>&1 | grep -iE "AssertionError|ReferenceError" | head -1
```
Expected: `AssertionError` (NOT ReferenceError). This proves the gate is meaningful. (Verified working in a scratch copy on 2026-06-23.)

- [ ] **Step 5: Commit**

```bash
git add scripts/benchmark-prepare.mjs benchmark/targets
git commit -m "Fix gameable acceptance tests: reference real fixture variable, regenerate targets"
```

---

## Task 2: Detect and reject the globalThis cheat

**Why:** A solution that writes `globalThis.db`/`global.tables` can satisfy a future broken test silently. Make accepted runs reject this so the harness can't be gamed again.

**Files:**
- Modify: `scripts/benchmark-run.mjs` (status computation near line 97) and `scripts/run-instrumented-codex.mjs` (status near line 73)
- Test: `scripts/test-benchmark-gates.mjs` (extend) OR a focused assertion in the batch

**Interfaces:**
- Consumes: the agent-changed source files list (`changedFiles`) + their contents in the run workspace.
- Produces: manifest `metrics.cheatSignals` (array) and a `failed` status if a forbidden global-injection pattern is present in changed source.

- [ ] **Step 1: Write the failing test**

Add to `scripts/test-benchmark-gates.mjs`:
```js
import { detectCheatSignals } from "./benchmark-run.mjs";
const dirty = detectCheatSignals(["src/workflow.mjs"], (f) => "export function applyBenchmarkTask(db){ globalThis.db = db; }");
assert(dirty.includes("global-injection"), "globalThis.db write must be flagged as a cheat");
const clean = detectCheatSignals(["src/workflow.mjs"], (f) => "export function applyBenchmarkTask(db){ return db; }");
assert(clean.length === 0, "clean solution has no cheat signals");
console.log("cheat-signal detection ok");
```

- [ ] **Step 2: Run it, verify it fails**

```bash
node scripts/test-benchmark-gates.mjs
```
Expected: FAIL (`detectCheatSignals is not a function`).

- [ ] **Step 3: Implement and export `detectCheatSignals`**

In `scripts/benchmark-run.mjs`, add and export:
```js
export function detectCheatSignals(changedFiles, readFileFn) {
  const signals = [];
  for (const file of changedFiles) {
    if (file.startsWith("tests/") || file.startsWith("data/")) continue;
    const text = readFileFn(file) || "";
    if (/\bglobalThis\.\w+\s*=|\bglobal\.\w+\s*=/.test(text)) signals.push("global-injection");
  }
  return [...new Set(signals)];
}
```
Then in `runCell`, after computing `changedFiles`, populate `metrics.cheatSignals` by reading each changed file from `workspace`, and force `status = "failed"` if signals are non-empty (and log it).

- [ ] **Step 4: Run tests, verify pass**

```bash
node scripts/test-benchmark-gates.mjs
```
Expected: `cheat-signal detection ok` and prior gate tests still pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/benchmark-run.mjs scripts/test-benchmark-gates.mjs
git commit -m "Reject global-injection cheat in accepted benchmark runs"
```

---

## Task 3: Real token + cost extractor (`scripts/agent-usage.mjs`)

**Why:** The user requires "token efficient" proof. Today tokens are `transcriptBytes/4`. Both CLIs emit real usage (verified 2026-06-23): Codex `turn.completed.usage{input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens}`; Claude `result.usage{input_tokens,output_tokens,cache_*}` + `result.total_cost_usd`.

**Files:**
- Create: `scripts/agent-usage.mjs`
- Create: `scripts/test-agent-usage.mjs`

**Interfaces:**
- Produces:
  - `extractUsage(agentId, transcriptText) -> { inputTokens, outputTokens, cachedInputTokens, totalTokens, costUsd, source }` where `source` is `"measured"` or `"estimated"`.
  - `PRICES` table for Codex cost derivation (input/output USD per token).

- [ ] **Step 1: Write the failing test**

`scripts/test-agent-usage.mjs`:
```js
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { extractUsage } from "./agent-usage.mjs";

// Codex: real captured transcript carries turn.completed.usage
const codexText = readFileSync("instrumented-agent-runs/order-exception-codex-v1/mongo/raw-transcript/codex-events.jsonl", "utf8");
const codex = extractUsage("codex", codexText);
assert(codex.inputTokens === 297998, `codex input tokens, got ${codex.inputTokens}`);
assert(codex.outputTokens === 8241, `codex output tokens, got ${codex.outputTokens}`);
assert(codex.source === "measured", "codex usage is measured");
assert(codex.costUsd > 0, "codex cost derived from tokens");

// Claude: result event carries usage + total_cost_usd
const claudeText = [
  JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 5 } } }),
  JSON.stringify({ type: "result", subtype: "success", total_cost_usd: 0.42, usage: { input_tokens: 1200, output_tokens: 800, cache_read_input_tokens: 16000 } })
].join("\n");
const claude = extractUsage("claude-code", claudeText);
assert(claude.outputTokens === 800, `claude output tokens, got ${claude.outputTokens}`);
assert(claude.costUsd === 0.42, "claude cost is the CLI-reported total");
assert(claude.source === "measured", "claude usage is measured");

// Fallback: empty transcript -> estimated, never throws
const fb = extractUsage("claude-code", "");
assert(fb.source === "estimated", "empty transcript falls back to estimated");
console.log("agent-usage extractor ok");
```

- [ ] **Step 2: Run it, verify it fails**

```bash
node scripts/test-agent-usage.mjs
```
Expected: FAIL (cannot find module `./agent-usage.mjs`).

- [ ] **Step 3: Implement `scripts/agent-usage.mjs`**

```js
// Published price snapshot; used only to derive cost when a CLI does not report it (Codex).
export const PRICES = {
  // USD per token (input, output). Snapshot constant; documented in README as an assumption.
  codex: { input: 0.0000025, output: 0.00001 }
};

function lastJsonMatch(text, predicate) {
  let found = null;
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const event = JSON.parse(trimmed);
      if (predicate(event)) found = event;
    } catch {}
  }
  return found;
}

export function extractUsage(agentId, transcriptText) {
  const empty = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 0, costUsd: 0, source: "estimated" };
  if (!transcriptText || !transcriptText.trim()) {
    return { ...empty, estimatedFromBytes: true };
  }

  if (agentId === "codex") {
    const turn = lastJsonMatch(transcriptText, (e) => e.type === "turn.completed" && e.usage);
    if (!turn) return estimate(transcriptText);
    const u = turn.usage;
    const inputTokens = Number(u.input_tokens || 0);
    const outputTokens = Number(u.output_tokens || 0);
    const cachedInputTokens = Number(u.cached_input_tokens || 0);
    const costUsd = inputTokens * PRICES.codex.input + outputTokens * PRICES.codex.output;
    return { inputTokens, outputTokens, cachedInputTokens, totalTokens: inputTokens + outputTokens, costUsd, source: "measured" };
  }

  if (agentId === "claude-code") {
    const result = lastJsonMatch(transcriptText, (e) => e.type === "result" && (e.usage || e.total_cost_usd !== undefined));
    if (!result) return estimate(transcriptText);
    const u = result.usage || {};
    const inputTokens = Number(u.input_tokens || 0);
    const outputTokens = Number(u.output_tokens || 0);
    const cachedInputTokens = Number(u.cache_read_input_tokens || 0);
    const costUsd = Number(result.total_cost_usd || 0);
    return { inputTokens, outputTokens, cachedInputTokens, totalTokens: inputTokens + outputTokens, costUsd, source: "measured" };
  }

  return estimate(transcriptText);
}

function estimate(transcriptText) {
  const bytes = Buffer.byteLength(transcriptText, "utf8");
  const totalTokens = Math.ceil(bytes / 4);
  return { inputTokens: totalTokens, outputTokens: 0, cachedInputTokens: 0, totalTokens, costUsd: 0, source: "estimated" };
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
node scripts/test-agent-usage.mjs
```
Expected: `agent-usage extractor ok`.

- [ ] **Step 5: Commit**

```bash
git add scripts/agent-usage.mjs scripts/test-agent-usage.mjs
git commit -m "Add real token+cost extractor for Codex and Claude Code transcripts"
```

---

## Task 4: Fix Claude Code adapter + wire real usage into manifests

**Why:** Verified 2026-06-23 — `benchmark-run.mjs:179-188` runs `claude -p --output-format stream-json` without `--verbose`, so it errors in 3s (`--output-format=stream-json requires --verbose`). Claude Code has never actually run. Also the manifest must carry real tokens/cost from Task 3.

**Files:**
- Modify: `scripts/benchmark-run.mjs:179-188` (claude args), `:125-138` (metrics block)
- Test: re-run the single Claude calibration cell

**Interfaces:**
- Consumes: `extractUsage` from Task 3.
- Produces: manifest `metrics.tokens` (object from extractUsage) alongside existing `estimatedTranscriptTokens` (kept for back-compat / fallback).

- [ ] **Step 1: Fix the Claude args**

In `scripts/benchmark-run.mjs`, the `claude-code` branch:
```js
  } else if (agentId === "claude-code") {
    command = "claude";
    args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      "bypassPermissions",
      prompt
    ];
  }
```

- [ ] **Step 2: Wire real usage into metrics**

Add `import { extractUsage } from "./agent-usage.mjs";` at top. In `runCell`, after reading the transcript text, compute:
```js
  const usage = extractUsage(cell.agentId, agentResult.transcriptText);
```
and add to the manifest `metrics` object:
```js
    tokens: usage,
    estimatedTranscriptTokens: usage.source === "measured" ? usage.totalTokens : estimateTokensFromBytes(transcriptBytes),
```

- [ ] **Step 3: Calibration run (one real Claude cell, timed)**

```bash
date "+START %H:%M:%S"; node scripts/benchmark-run.mjs --task strategic-account-rescue --lane mongo --agent claude-code --repeat 1; date "+END %H:%M:%S"
```
Expected: `AST-Bench run passed: strategic-account-rescue/claude-code/mongo/repeat-1`. Record wall time (used to size the full batch). Inspect the manifest:
```bash
node -e "const m=require('./benchmark/runs/ast-bench-v1/strategic-account-rescue/claude-code/repeat-1/mongo/run-manifest.json'); console.log(m.status, m.metrics.tokens)"
```
Expected: `passed` and `tokens.source === "measured"` with non-zero output tokens and `costUsd > 0`.

> **CHECKPOINT (report to user):** real per-run wall time, the measured token/cost numbers, and projected total batch time for 60 runs. If a task cannot pass on a lane even with a real solution, surface it; do not loosen the test.

- [ ] **Step 4: Commit**

```bash
git add scripts/benchmark-run.mjs
git commit -m "Fix Claude Code adapter (--verbose) and record real token+cost in run manifest"
```

---

## Task 5: Discard tainted evidence; stop counting it

**Why:** The recorded `renewal-risk` "passed" run and the Codex seed replay were validated under the broken/gameable test regime. Counting them as proof would overclaim. Keep them as archived raw artifacts but exclude from scored results until re-run cleanly.

**Files:**
- Modify: `scripts/benchmark-score.mjs:29-32, 116-162` (seed inclusion), and the agent `capturedLaneRuns` math at `:50-56`
- Modify: `scripts/benchmark-build-public-bundle.mjs` (seed framing) — only what is needed to keep gates green

**Interfaces:**
- Produces: `summary.json` whose `capturedLaneRuns`/`passedLaneRuns` count **only** runs produced under the fixed harness (with no `cheatSignals`).

- [ ] **Step 1: Quarantine the tainted run + seed from scoring**

In `benchmark-score.mjs`, filter captured runs to exclude any with `metrics.cheatSignals?.length`, and gate the seed contribution behind a `SEED_VERIFIED_CLEAN` constant set to `false` (with a one-line code comment explaining the 2026-06-23 gameable-test finding). Set `seedLaneRuns = SEED_VERIFIED_CLEAN && seed?.status === "passed" ? 2 : 0;`.

- [ ] **Step 2: Run score, verify honest counts**

```bash
node scripts/benchmark-score.mjs
node -e "const s=require('./benchmark/results/summary.json'); console.log('status',s.status,'captured',s.capturedLaneRuns,'passed',s.passedLaneRuns)"
```
Expected: counts reflect only clean runs (after Task 4 calibration: small, honest number). Status stays `case-study`.

- [ ] **Step 3: Keep gates green**

```bash
npm run benchmark:gates && npm run benchmark:test-gates
```
Expected: both pass. If the seed-removal breaks a gate that hard-requires the seed bundle, adjust the gate to treat the seed as archived (not scored) rather than re-including tainted data.

- [ ] **Step 4: Commit**

```bash
git add scripts/benchmark-score.mjs scripts/benchmark-build-public-bundle.mjs
git commit -m "Quarantine pre-fix tainted runs from scored benchmark results"
```

---

## Task 6: Resumable background batch runner

**Why:** 60 real runs (5 tasks × 2 lanes × 3 repeats × 2 agents) must run unattended, survive a failed cell, and skip already-captured cells on resume.

**Files:**
- Create: `scripts/benchmark-run-batch.mjs`

**Interfaces:**
- Consumes: `benchmark-run.mjs` per cell, `runManifestPath` from `benchmark-lib.mjs`.
- Produces: a `benchmark/runs/.../run-manifest.json` per cell; a `benchmark/runs/batch-log.json` progress file.

- [ ] **Step 1: Implement the batch runner**

```js
#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { runManifestPath, writeJson } from "./benchmark-lib.mjs";

const TASKS = ["strategic-account-rescue","split-shipment-exception","sla-breach-route","invoice-dispute-workflow","data-access-audit-export"];
const LANES = ["mongo","postgres"];
const AGENTS = ["claude-code","codex"];
const REPEATS = [1,2,3];
const log = [];
for (const taskId of TASKS) for (const agentId of AGENTS) for (const repeat of REPEATS) for (const lane of LANES) {
  const path = runManifestPath({ suiteId: "ast-bench-v1", taskId, agentId, lane, repeat });
  if (existsSync(path)) { log.push({ taskId, agentId, lane, repeat, status: "skipped-exists" }); continue; }
  const r = spawnSync(process.execPath, ["scripts/benchmark-run.mjs","--task",taskId,"--lane",lane,"--agent",agentId,"--repeat",String(repeat)], { encoding: "utf8", stdio: "inherit" });
  log.push({ taskId, agentId, lane, repeat, exit: r.status });
  writeJson("benchmark/runs/batch-log.json", { updatedCells: log.length, log });
}
console.log(`Batch complete: ${log.length} cells`);
```

- [ ] **Step 2: Dry-verify the cell list (no agent calls)**

```bash
node -e "const T=['strategic-account-rescue','split-shipment-exception','sla-breach-route','invoice-dispute-workflow','data-access-audit-export'],L=['mongo','postgres'],A=['claude-code','codex'],R=[1,2,3];let n=0;for(const t of T)for(const a of A)for(const r of R)for(const l of L)n++;console.log('cells',n)"
```
Expected: `cells 60`.

- [ ] **Step 3: Launch the batch in the background**

```bash
node scripts/benchmark-run-batch.mjs
```
Run with `run_in_background: true`. Monitor `benchmark/runs/batch-log.json`.

> **CHECKPOINT (report to user):** when the batch finishes — cells passed/failed/exempt per agent per lane, and any task that no agent could pass on a lane (surfaced honestly, not hidden).

- [ ] **Step 4: Commit the runner (artifacts committed after the batch)**

```bash
git add scripts/benchmark-run-batch.mjs
git commit -m "Add resumable background batch runner for the 60-cell DB benchmark"
```

---

## Task 7: Score within-agent deltas + agent agreement

**Why:** The valid comparison is within-agent; the headline is whether **both** agents independently needed more on Postgres. Use real tokens (Task 3) and median across repeats with spread.

**Files:**
- Modify: `scripts/benchmark-score.mjs` (`aggregateRuns` → real tokens; add `databaseVerdict`)

**Interfaces:**
- Produces in `summary.json` a `databaseVerdict` block:
```
databaseVerdict: {
  perAgent: [{ agentId, lane: {mongo:{medianTokens,medianCostUsd,medianElapsedMs,medianRetrySignals,runs}, postgres:{...}}, deltas:{tokensPct,costPct,timePct,retries}, mongoWins: bool }],
  agreement: { agentsAgreeMongoFewerTokens: bool, agentCount, statement },
  caveat: "Within-agent comparison only. Cross-agent numbers are not comparable."
}
```

- [ ] **Step 1: Write the failing test**

Create `scripts/test-database-verdict.mjs`:
```js
import assert from "node:assert";
import { computeDatabaseVerdict } from "./benchmark-score.mjs";
const runs = [
  { agentId:"claude-code", lane:"mongo", status:"passed", metrics:{ tokens:{totalTokens:1000,costUsd:0.10}, elapsedMs:60000, retrySignals:2 } },
  { agentId:"claude-code", lane:"postgres", status:"passed", metrics:{ tokens:{totalTokens:1500,costUsd:0.15}, elapsedMs:90000, retrySignals:5 } },
  { agentId:"codex", lane:"mongo", status:"passed", metrics:{ tokens:{totalTokens:2000,costUsd:0.02}, elapsedMs:120000, retrySignals:3 } },
  { agentId:"codex", lane:"postgres", status:"passed", metrics:{ tokens:{totalTokens:2600,costUsd:0.026}, elapsedMs:160000, retrySignals:7 } }
];
const v = computeDatabaseVerdict(runs);
assert(v.perAgent.length === 2, "two agents");
assert(v.perAgent.every(a => a.mongoWins === true), "mongo fewer tokens for both agents");
assert(v.agreement.agentsAgreeMongoFewerTokens === true, "agents agree");
console.log("database verdict ok");
```

- [ ] **Step 2: Run it, verify it fails**

```bash
node scripts/test-database-verdict.mjs
```
Expected: FAIL (`computeDatabaseVerdict is not a function`).

- [ ] **Step 3: Implement and export `computeDatabaseVerdict`**

In `benchmark-score.mjs`, add (using existing `median` import):
```js
export function computeDatabaseVerdict(runs) {
  const passed = runs.filter((r) => r.status === "passed" && !(r.metrics?.cheatSignals?.length));
  const agents = [...new Set(passed.map((r) => r.agentId))];
  const perAgent = agents.map((agentId) => {
    const lane = (id) => {
      const rows = passed.filter((r) => r.agentId === agentId && r.lane === id);
      const tok = (r) => r.metrics.tokens?.totalTokens ?? r.metrics.estimatedTranscriptTokens ?? 0;
      return {
        runs: rows.length,
        medianTokens: median(rows.map(tok)),
        medianCostUsd: median(rows.map((r) => r.metrics.tokens?.costUsd ?? 0)),
        medianElapsedMs: median(rows.map((r) => r.metrics.elapsedMs)),
        medianRetrySignals: median(rows.map((r) => r.metrics.retrySignals))
      };
    };
    const mongo = lane("mongo");
    const postgres = lane("postgres");
    const pct = (a, b) => (a > 0 ? Math.round(((b - a) / a) * 100) : 0);
    return {
      agentId, mongo, postgres,
      deltas: {
        tokensPct: pct(mongo.medianTokens, postgres.medianTokens),
        costPct: pct(mongo.medianCostUsd, postgres.medianCostUsd),
        timePct: pct(mongo.medianElapsedMs, postgres.medianElapsedMs),
        retries: postgres.medianRetrySignals - mongo.medianRetrySignals
      },
      mongoWins: mongo.medianTokens > 0 && postgres.medianTokens > mongo.medianTokens
    };
  });
  const agree = perAgent.length > 0 && perAgent.every((a) => a.mongoWins);
  return {
    perAgent,
    agreement: {
      agentsAgreeMongoFewerTokens: agree,
      agentCount: perAgent.length,
      statement: agree
        ? `All ${perAgent.length} agents independently needed fewer tokens on MongoDB for the same tasks.`
        : "Agents did not unanimously favor MongoDB on tokens; see per-agent detail."
    },
    caveat: "Within-agent comparison only. Cross-agent absolute numbers are not comparable."
  };
}
```
Then add `databaseVerdict: computeDatabaseVerdict(capturedRuns)` to the `summary` object.

- [ ] **Step 4: Run tests + score, verify pass**

```bash
node scripts/test-database-verdict.mjs && node scripts/benchmark-score.mjs
node -e "const s=require('./benchmark/results/summary.json'); console.log(JSON.stringify(s.databaseVerdict.agreement,null,2))"
```
Expected: `database verdict ok` and a real agreement block from captured runs.

- [ ] **Step 5: Commit**

```bash
git add scripts/benchmark-score.mjs scripts/test-database-verdict.mjs
git commit -m "Score within-agent DB deltas and agent-agreement from real tokens"
```

---

## Task 8: Surface the verdict in the public bundle

**Why:** The console reads `public-bundle.json`. It must carry `databaseVerdict` and keep every existing gate-required field.

**Files:**
- Modify: `scripts/benchmark-build-public-bundle.mjs` (add `databaseVerdict: result.databaseVerdict` to the `bundle` object; add a `plainEnglish.databaseAnswer` line)

**Interfaces:**
- Consumes: `summary.json.databaseVerdict` (Task 7).
- Produces: `benchmark/public-bundle.json` + lab copy with `databaseVerdict` and an honest headline.

- [ ] **Step 1: Add the verdict to the bundle**

In `benchmark-build-public-bundle.mjs`, add to the `bundle` object:
```js
  databaseVerdict: result.databaseVerdict,
```
and extend `plainEnglish` with:
```js
    databaseAnswer: result.databaseVerdict?.agreement?.statement || "Benchmark in progress.",
```

- [ ] **Step 2: Rebuild + verify gates**

```bash
npm run benchmark:bundle && npm run benchmark:gates && npm run benchmark:test-gates
node -e "const b=require('./benchmark/public-bundle.json'); console.log(b.plainEnglish.databaseAnswer)"
```
Expected: all gates pass; the database answer prints.

- [ ] **Step 3: Commit**

```bash
git add scripts/benchmark-build-public-bundle.mjs benchmark/public-bundle.json prototypes/lab-console/evidence/ast-bench-v1/benchmark-public-bundle.json
git commit -m "Expose within-agent database verdict in public bundle"
```

---

## Task 9: Rework the console first viewport

**Why:** The user calls the UI "far behind." First 10 seconds must answer: *what was tested, which DB won, by how much, can I inspect proof* — for non-technical and technical viewers. Keep the data-contract + fail-closed discipline and the gate-required IDs/functions/copy.

**Files:**
- Modify: `prototypes/lab-console/index.html` (hero/lane-board/seed-receipt region + the JS that renders the verdict). Keep all IDs in `benchmark-ui-test.mjs:14-30` and functions at `:42-55`, and required copy at `:33`.

**Interfaces:**
- Consumes: `databaseVerdict` from the bundle.
- Produces: a hero that leads with one headline number (median within-agent token reduction), an agent-agreement badge ("2 independent agents agree"), a two-bar Mongo-vs-Postgres comparison, and one obvious "Inspect proof" path. Mixed-metric losses stay visible.

- [ ] **Step 1: Render the verdict (new function, gate-safe)**

Add a `renderDatabaseVerdict(bundle)` function that fills the hero headline + agreement badge from `bundle.databaseVerdict`. Keep existing `renderLaneBoard`, `renderActionReceipt`, `activateClaim`, `controlFromTrigger`, `renderActiveStates`, `selectedTask`, `selectedAgent` intact (the UI gate asserts them).

- [ ] **Step 2: Verify the UI gate + no-mock gate still pass**

```bash
npm run benchmark:ui:test && npm run proof:no-mock
```
Expected: both pass. If a required copy string must change (e.g. the literal "MongoDB made the AI do less database work."), update **both** the page and the corresponding assertion in `benchmark-ui-test.mjs`/`check-no-mock-data.mjs` in the same commit, with a note in the commit body.

- [ ] **Step 3: Browser smoke (MANDATORY per user rule — build/lint passing ≠ working UI)**

```bash
npm run prototype:lab
```
Open `http://127.0.0.1:4173/`, confirm: hero shows the real number, agreement badge renders, lane bars draw, "Inspect proof" opens the drawer, every button visibly changes state, no console errors. Capture what you observed.

- [ ] **Step 4: Commit**

```bash
git add prototypes/lab-console/index.html scripts/benchmark-ui-test.mjs scripts/check-no-mock-data.mjs
git commit -m "Rework console first viewport to lead with within-agent DB verdict"
```

---

## Task 10: Docs + final full verification

**Why:** README/demo script still say "Codex-only seed." Update to the real Claude+Codex DB benchmark with honest caveats, then run every gate.

**Files:**
- Modify: `README.md` (Proof Status, agent list, token-source note), `docs/seller-demo-script.md` (within-agent framing, drop "Why Codex only?")

- [ ] **Step 1: Update README + demo script**

Reflect: real tokens+cost, Claude Code + Codex as instruments, within-agent-only rule, the gameable-test fix (briefly, as a credibility strength), honest run count, no `public-v1` claim.

- [ ] **Step 2: Run the full gate suite**

```bash
npm run build && npm run benchmark:score && npm run benchmark:bundle && npm run benchmark:gates && npm run benchmark:test-gates && npm run benchmark:ui:test && npm run proof:no-mock
```
Expected: every command exits 0.

- [ ] **Step 3: Final browser smoke + summary to user**

Re-open the console; confirm the shipped story matches the data. Report: final counts, the headline number, agent agreement, any exempt cells, and the deploy path.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/seller-demo-script.md
git commit -m "Document real Claude Code + Codex database benchmark and within-agent rule"
```

---

## Self-Review (completed inline)

- **Spec coverage:** real tokens (T3,4), Claude adapter (T4), 60 runs (T6), within-agent scoring (T7,8), console rework (T9), guardrails preserved (T5,8,9), docs (T10). The gameable-test discovery (not in the original spec) is covered by T1,2,5 — a required addition because it invalidates all downstream evidence.
- **Placeholder scan:** none — every code/test step shows real code; commands show expected output.
- **Type consistency:** `extractUsage` shape (`{inputTokens,outputTokens,cachedInputTokens,totalTokens,costUsd,source}`) is consistent across T3/T4/T7; `databaseVerdict` shape consistent across T7/T8/T9; `detectCheatSignals` consistent T2/T5.
- **Risk:** if a task genuinely can't pass on a lane with a real solution, T6 surfaces it as exempt rather than loosening the test (honesty over completeness).
