#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { runManifestPath, runManifestPathV2, writeJson } from "./benchmark-lib.mjs";

const suiteFlag = process.argv.includes("--suite") ? process.argv[process.argv.indexOf("--suite") + 1] : "ast-bench-v1";

if (suiteFlag === "ast-bench-v2") {
  const SHAPES = ["shallow", "moderate", "deep"];
  const LANES = ["mongo", "postgres"];
  const AGENTS = ["claude-code", "codex"];
  const REPEATS = [1, 2, 3, 4, 5];
  const log = [];

  for (const shape of SHAPES) for (const agentId of AGENTS) for (const repeat of REPEATS) for (const lane of LANES) {
    const path = runManifestPathV2({ shape, agentId, lane, repeat });
    if (existsSync(path)) { log.push({ shape, agentId, lane, repeat, status: "skipped-exists" }); continue; }
    const r = spawnSync(process.execPath, [
      "scripts/benchmark-run.mjs",
      "--suite", "ast-bench-v2",
      "--shape", shape,
      "--lane", lane,
      "--agent", agentId,
      "--repeat", String(repeat)
    ], { encoding: "utf8", stdio: "inherit" });
    log.push({ shape, agentId, lane, repeat, exit: r.status });
    writeJson("benchmark/runs-v2/batch-log.json", { updatedCells: log.length, log });
  }

  console.log(`V2 batch complete: ${log.length} cells`);
} else {
  // v1 path — unchanged behavior
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
}
