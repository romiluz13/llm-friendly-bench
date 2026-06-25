#!/usr/bin/env node
// AST-Bench V3 scorer — within-agent medians across 3 lanes, from CLEAN live-DB
// manifests only (passed + liveDbWritten + no cheat signals + only workflow.mjs
// edited). Emits benchmark/results/summary-v3.json. Pure read+aggregate, no runs.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { writeJson, median } from "./benchmark-lib.mjs";

const ROOT = "benchmark/runs-v3";
const OUT = "benchmark/results/summary-v3.json";
const SHAPES = ["shallow", "moderate", "deep"];
const LANES = ["mongo", "postgres-norm", "postgres-jsonb"];
const AGENTS = [
  { id: "claude-code", label: "Claude Code", model: "sonnet (Sonnet 4.6)" },
  { id: "codex", label: "Codex", model: "gpt-5.4-mini" }
];

export function isClean(m) {
  return m
    && m.status === "passed"
    && m.metrics?.liveDbWritten === true
    && (m.metrics?.cheatSignals?.length || 0) === 0
    && (m.metrics?.changedFiles || []).join() === "src/workflow.mjs";
}

function manifestsFor(agentId, lane, shape) {
  const out = [];
  for (let r = 1; r <= 5; r += 1) {
    const p = join(ROOT, shape, lane, agentId, `repeat-${r}`, "run-manifest.json");
    if (!existsSync(p)) continue;
    try { out.push(JSON.parse(readFileSync(p, "utf8"))); } catch { /* skip unreadable */ }
  }
  return out;
}

function laneStats(agentId, lane, shape /* optional */) {
  const shapes = shape ? [shape] : SHAPES;
  const tok = [], cost = [], time = [], retries = [];
  for (const sh of shapes) {
    for (const m of manifestsFor(agentId, lane, sh)) {
      if (!isClean(m)) continue;
      tok.push(m.metrics.tokens.tokensRead);
      cost.push(m.metrics.tokens.costUsd || 0);
      time.push(m.metrics.elapsedMs);
      retries.push(m.metrics.retrySignals || 0);
    }
  }
  return {
    cleanRepeats: tok.length,
    medianTokensRead: median(tok),
    medianCostUsd: median(cost),
    medianElapsedMs: median(time),
    medianRetrySignals: median(retries)
  };
}

function pct(base, v) { return base > 0 ? Math.round(((v - base) / base) * 100) : null; }

function scoreAgent(agentId) {
  const lanes = {};
  for (const lane of LANES) lanes[lane] = laneStats(agentId, lane);
  const baseTok = lanes.mongo.medianTokensRead;
  const baseCost = lanes.mongo.medianCostUsd;
  const baseTime = lanes.mongo.medianElapsedMs;
  const vsMongo = {};
  for (const lane of ["postgres-norm", "postgres-jsonb"]) {
    vsMongo[lane] = {
      tokensPct: pct(baseTok, lanes[lane].medianTokensRead),
      costPct: pct(baseCost, lanes[lane].medianCostUsd),
      timePct: pct(baseTime, lanes[lane].medianElapsedMs)
    };
  }
  // per-shape token deltas vs that shape's mongo
  const perShape = SHAPES.map((shape) => {
    const mg = laneStats(agentId, "mongo", shape).medianTokensRead;
    const row = { shape, mongoTokens: mg };
    for (const lane of ["postgres-norm", "postgres-jsonb"]) {
      const v = laneStats(agentId, lane, shape).medianTokensRead;
      row[lane] = { medianTokensRead: v, tokensPct: pct(mg, v) };
    }
    return row;
  });
  return { agentId, lanes, vsMongo, perShape };
}

function countFailures() {
  // walk all manifests; a "failure" = manifest exists but not clean
  let clean = 0, failed = 0, total = 0;
  const reasons = {};
  for (const shape of SHAPES) for (const lane of LANES) for (const a of AGENTS) {
    for (const m of manifestsFor(a.id, lane, shape)) {
      total += 1;
      if (isClean(m)) { clean += 1; continue; }
      failed += 1;
      const sig = (m.metrics?.cheatSignals || [])[0]
        || (m.metrics?.changedFiles || []).join() !== "src/workflow.mjs" && "off-contract-files"
        || (m.metrics?.testStatus !== "passed" && "test-failed")
        || "other";
      reasons[sig] = (reasons[sig] || 0) + 1;
    }
  }
  return { total, clean, failed, reasons };
}

export function scoreV3() {
  const agents = AGENTS.map((a) => ({ ...a, ...scoreAgent(a.id) }));
  const integrity = countFailures();

  // Headline logic (data-driven): both agents agree normalized PG costs more?
  const normWorseBoth = agents.every((a) => (a.vsMongo["postgres-norm"].tokensPct || 0) > 0);
  const jsonbSplit = !agents.every((a) => (a.vsMongo["postgres-jsonb"].tokensPct || 0) > 0);

  const summary = {
    schemaVersion: "3.0.0",
    suiteId: "ast-bench-v3",
    generatedAt: new Date().toISOString(),
    executionMode: "live-db",
    lanes: LANES,
    shapes: SHAPES,
    agents,
    integrity,
    findings: {
      normalizedPostgresWorseOnBothAgents: normWorseBoth,
      tunedJsonbSplitsAgents: jsonbSplit
    },
    caveat: "Within-agent comparison only. Each agent is measured against itself across the three database designs; one agent's absolute numbers are never compared to the other's, because the two CLIs count tokens incompatibly."
  };
  writeJson(OUT, summary);
  return summary;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const s = scoreV3();
  console.log(`AST-Bench v3 score emitted: ${OUT}`);
  console.log(`Clean ${s.integrity.clean}/${s.integrity.total} (failed ${s.integrity.failed}: ${JSON.stringify(s.integrity.reasons)})`);
  for (const a of s.agents) {
    console.log(`\n${a.label} (${a.model}):`);
    for (const lane of LANES) console.log(`  ${lane.padEnd(15)} n=${a.lanes[lane].cleanRepeats} medTok=${a.lanes[lane].medianTokensRead} medCost=$${(a.lanes[lane].medianCostUsd || 0).toFixed(2)}`);
    console.log(`  vs mongo: norm +${a.vsMongo["postgres-norm"].tokensPct}% tok / +${a.vsMongo["postgres-norm"].costPct}% cost   jsonb ${a.vsMongo["postgres-jsonb"].tokensPct}% tok / ${a.vsMongo["postgres-jsonb"].costPct}% cost`);
  }
  console.log(`\nfindings: normWorseBoth=${s.findings.normalizedPostgresWorseOnBothAgents} jsonbSplit=${s.findings.tunedJsonbSplitsAgents}`);
}
