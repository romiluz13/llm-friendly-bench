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
