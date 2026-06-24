#!/usr/bin/env node
// AST-Bench V3 full batch — 3 shapes × 3 lanes × 2 agents × 5 repeats = 90.
// Resilient + resumable: skips cells whose manifest already shows a clean pass,
// isolates per-cell errors, paces between runs (Codex rate-limit cascade), and
// appends a progress line per cell so an overnight run is observable + survivable.
//
// Usage: node scripts/benchmark-batch-v3.mjs [--shapes a,b] [--agents x,y] [--repeats N] [--pace-ms 15000]

import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runCellV3 } from "./benchmark-run-v3.mjs";
import { LANES } from "./benchmark-livedb.mjs";

const ALL_SHAPES = ["shallow", "moderate", "deep"];
const ALL_AGENTS = ["claude-code", "codex"];
const RUN_ROOT = "benchmark/runs-v3";
const PROGRESS = join(RUN_ROOT, "batch-progress.log");

const shapes = csv("--shapes", ALL_SHAPES);
const agents = csv("--agents", ALL_AGENTS);
const lanes = csv("--lanes", LANES);
const repeats = Number(flag("--repeats") || 5);
const paceMs = Number(flag("--pace-ms") || 15000);
const force = process.argv.includes("--force");

mkdirSync(RUN_ROOT, { recursive: true });

// Build the cell list. Interleave agents/lanes so a transient outage on one
// agent doesn't wipe a whole contiguous block.
const cells = [];
for (let repeat = 1; repeat <= repeats; repeat += 1)
  for (const shape of shapes)
    for (const lane of lanes)
      for (const agentId of agents)
        cells.push({ shape, lane, agentId, repeat });

const started = nowStamp();
log(`BATCH START ${started} — ${cells.length} cells (${shapes.length} shapes × ${lanes.length} lanes × ${agents.length} agents × ${repeats} repeats), pace=${paceMs}ms`);

let done = 0, passed = 0, failed = 0, skipped = 0;
for (const cell of cells) {
  done += 1;
  const tag = `${cell.shape}/${cell.lane}/${cell.agentId}/r${cell.repeat}`;
  if (!force && alreadyClean(cell)) {
    skipped += 1; passed += 1;
    log(`[${done}/${cells.length}] SKIP (already clean) ${tag}`);
    continue;
  }
  try {
    const res = runCellV3({ ...cell, keepNs: false }); // model defaults per-agent inside runCellV3
    if (res.status === "passed") { passed += 1; log(`[${done}/${cells.length}] PASS ${tag} tok=${res.tokensRead} model=${res.model}`); }
    else { failed += 1; log(`[${done}/${cells.length}] FAIL ${tag} (status=${res.status})`); }
  } catch (e) {
    failed += 1;
    log(`[${done}/${cells.length}] ERROR ${tag}: ${String(e.message).slice(0, 200)}`);
  }
  if (done < cells.length) sleepSync(paceMs);
}

log(`BATCH DONE — passed=${passed} failed=${failed} skipped=${skipped} of ${cells.length}`);

function alreadyClean(cell) {
  const p = join(RUN_ROOT, cell.shape, cell.lane, cell.agentId, `repeat-${cell.repeat}`, "run-manifest.json");
  if (!existsSync(p)) return false;
  try {
    const m = JSON.parse(readFileSync(p, "utf8"));
    return m.status === "passed"
      && m.metrics?.liveDbWritten === true
      && (m.metrics?.cheatSignals?.length || 0) === 0
      && (m.metrics?.changedFiles || []).join() === "src/workflow.mjs";
  } catch { return false; }
}

function csv(name, fallback) { const v = flag(name); return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : fallback; }
function flag(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : ""; }
function log(line) { const s = `${nowStamp()} ${line}`; console.log(s); try { appendFileSync(PROGRESS, s + "\n"); } catch { /* ignore */ } }
function nowStamp() { return new Date().toISOString().replace("T", " ").slice(0, 19); }
function sleepSync(ms) { const end = Date.now() + ms; while (Date.now() < end) { /* spin-free wait */ Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(ms, end - Date.now())); } }
