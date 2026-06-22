#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  benchmarkTaskPrompt,
  estimateTokensFromBytes,
  hashExisting,
  listTasks,
  readSuite,
  runDir,
  targetWorkspacePath,
  writeJson,
  writeText
} from "./benchmark-lib.mjs";
import { extractUsage } from "./agent-usage.mjs";

const suite = readSuite();

export function detectCheatSignals(changedFiles, readFileFn) {
  const signals = [];
  for (const file of changedFiles) {
    if (file.startsWith("tests/") || file.startsWith("data/")) continue;
    const text = readFileFn(file) || "";
    if (/\bglobalThis\.\w+\s*=|\bglobal\.\w+\s*=/.test(text)) signals.push("global-injection");
  }
  return [...new Set(signals)];
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const taskId = valueAfter("--task");
  const lane = valueAfter("--lane");
  const agentId = valueAfter("--agent");
  const repeat = Number(valueAfter("--repeat") || 1);
  const runAll = process.argv.includes("--all");

  if (runAll && process.env.AST_BENCH_RUN_FULL !== "1") {
    console.error("Full V1 run requires AST_BENCH_RUN_FULL=1 because it may launch 450 agent runs.");
    process.exit(1);
  }

  if (!runAll && (!taskId || !lane || !agentId)) {
    console.error("Usage: node scripts/benchmark-run.mjs --task <taskId> --lane <mongo|postgres> --agent <codex|claude-code|cursor> [--repeat 1]");
    process.exit(1);
  }

  const cells = runAll ? allCells() : [{ taskId, lane, agentId, repeat }];
  for (const cell of cells) runCell(cell);
}

function allCells() {
  const cells = [];
  for (const task of listTasks(suite)) {
    for (const agent of suite.agents) {
      for (let currentRepeat = 1; currentRepeat <= suite.repeatsPerCell; currentRepeat += 1) {
        for (const dbLane of suite.lanes) {
          cells.push({ taskId: task.id, lane: dbLane.id, agentId: agent.id, repeat: currentRepeat });
        }
      }
    }
  }
  return cells;
}

function runCell(cell) {
  const task = listTasks(suite).find((item) => item.id === cell.taskId);
  const agent = suite.agents.find((item) => item.id === cell.agentId);
  const dbLane = suite.lanes.find((item) => item.id === cell.lane);
  if (!task) throw new Error(`Unknown task: ${cell.taskId}`);
  if (!agent) throw new Error(`Unknown agent: ${cell.agentId}`);
  if (!dbLane) throw new Error(`Unknown lane: ${cell.lane}`);
  if (cell.repeat < 1 || cell.repeat > suite.repeatsPerCell) throw new Error(`Invalid repeat: ${cell.repeat}`);

  const targetWorkspace = targetWorkspacePath(task.id, cell.lane);
  if (!existsSync(targetWorkspace)) {
    const prep = spawnSync(process.execPath, ["scripts/benchmark-prepare.mjs", "--task", task.id, "--lane", cell.lane], { encoding: "utf8" });
    if (prep.status !== 0) throw new Error(`Prepare failed\n${prep.stdout || ""}${prep.stderr || ""}`);
  }

  const outDir = runDir({ suiteId: suite.suiteId, ...cell });
  const workspace = join(outDir, "workspace");
  rmSync(workspace, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(targetWorkspace, workspace, { recursive: true });
  mkdirSync(join(outDir, "raw-transcript"), { recursive: true });
  mkdirSync(join(outDir, "screenshots"), { recursive: true });
  mkdirSync(join(outDir, "db-before"), { recursive: true });
  mkdirSync(join(outDir, "db-after"), { recursive: true });

  const prompt = benchmarkTaskPrompt(task, cell.lane);
  writeText(join(outDir, "prompt.md"), prompt);
  copyIfExists(join(workspace, "data", cell.lane === "mongo" ? "collections.json" : "tables.json"), join(outDir, "db-before", cell.lane === "mongo" ? "collections.json" : "tables.json"));

  const frozenSha = initGit(workspace);
  const startedAt = new Date();
  const startMs = Date.now();
  const agentResult = runAgent({ agentId: cell.agentId, workspace, prompt, outDir });
  const test = spawnSync("npm", ["test"], { cwd: workspace, encoding: "utf8" });
  writeText(join(outDir, "tests.log"), `${test.stdout || ""}${test.stderr || ""}`);
  const render = test.status === 0 ? spawnSync("npm", ["run", "render"], { cwd: workspace, encoding: "utf8" }) : { stdout: "", stderr: "", status: 1 };
  writeText(join(outDir, "render.log"), `${render.stdout || ""}${render.stderr || ""}`);
  copyIfExists(join(workspace, "artifacts", "before-after.json"), join(outDir, "acceptance.json"));
  copyIfExists(join(workspace, "artifacts", "before-after.svg"), join(outDir, "screenshots", "before-after.svg"));
  copyIfExists(join(workspace, "artifacts", "before-after.json"), join(outDir, "db-after", `${cell.lane}-workflow-after.json`));

  const diffArgs = frozenSha ? ["diff", frozenSha, "--", "."] : ["diff", "--", "."];
  const diffNameArgs = frozenSha ? ["diff", "--name-only", frozenSha, "--", "."] : ["diff", "--name-only", "--", "."];
  const diff = commandOutput("git", diffArgs, workspace);
  writeText(join(outDir, "diff.patch"), diff);
  const changedFiles = commandOutput("git", diffNameArgs, workspace).split(/\r?\n/).filter(Boolean);
  const cheatSignals = detectCheatSignals(changedFiles, (f) => {
    try { return readFileSync(join(workspace, f), "utf8"); } catch { return ""; }
  });
  const transcriptBytes = (agentResult.stdoutBytes || 0) + (agentResult.stderrBytes || 0);
  const usage = extractUsage(cell.agentId, agentResult.transcriptText);
  let status = agentResult.status === 0 && test.status === 0 ? "passed" : "failed";
  if (cheatSignals.length > 0) {
    status = "failed";
    console.error(`AST-Bench: cheat signals detected (${cheatSignals.join(", ")}) — run marked failed`);
  }
  const manifest = {
    schemaVersion: "1.0.0",
    suiteId: suite.suiteId,
    taskId: task.id,
    taskTitle: task.title,
    agentId: cell.agentId,
    agentLabel: agent.label,
    agentVersion: agentVersion(cell.agentId),
    lane: cell.lane,
    laneLabel: dbLane.label,
    repeat: cell.repeat,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    artifacts: {
      workspace,
      prompt: join(outDir, "prompt.md"),
      rawTranscript: agentResult.transcriptPath,
      stderr: agentResult.stderrPath,
      diff: join(outDir, "diff.patch"),
      tests: join(outDir, "tests.log"),
      render: join(outDir, "render.log"),
      acceptance: join(outDir, "acceptance.json"),
      screenshot: join(outDir, "screenshots", "before-after.svg"),
      dbBefore: join(outDir, "db-before", cell.lane === "mongo" ? "collections.json" : "tables.json"),
      dbAfter: join(outDir, "db-after", `${cell.lane}-workflow-after.json`)
    },
    metrics: {
      elapsedMs: Date.now() - startMs,
      transcriptBytes,
      tokens: usage,
      estimatedTranscriptTokens: usage.source === "measured" ? usage.totalTokens : estimateTokensFromBytes(transcriptBytes),
      diffBytes: Buffer.byteLength(diff, "utf8"),
      filesChanged: changedFiles.length,
      changedFiles,
      cheatSignals,
      commandCount: agentResult.commandCount,
      failedCommandCount: agentResult.failedCommandCount,
      retrySignals: countRetrySignals(`${agentResult.transcriptText}\n${agentResult.stderrText}\n${test.stdout || ""}\n${test.stderr || ""}`),
      testStatus: test.status === 0 ? "passed" : "failed",
      agentExitCode: agentResult.status,
      testsExitCode: test.status
    },
    evidenceSha256: hashExisting([
      join(outDir, "prompt.md"),
      agentResult.transcriptPath,
      agentResult.stderrPath,
      join(outDir, "diff.patch"),
      join(outDir, "tests.log"),
      join(outDir, "acceptance.json"),
      join(outDir, "screenshots", "before-after.svg"),
      join(outDir, "db-before", cell.lane === "mongo" ? "collections.json" : "tables.json"),
      join(outDir, "db-after", `${cell.lane}-workflow-after.json`)
    ])
  };

  writeJson(join(outDir, "run-manifest.json"), manifest);
  console.log(`AST-Bench run ${status}: ${task.id}/${cell.agentId}/${cell.lane}/repeat-${cell.repeat}`);
  if (status !== "passed") process.exitCode = 1;
}

function runAgent({ agentId, workspace, prompt, outDir }) {
  const transcriptPath = join(outDir, "raw-transcript", `${agentId}.jsonl`);
  const stderrPath = join(outDir, "raw-transcript", `${agentId}-stderr.log`);
  let command;
  let args;
  let cwd = workspace;

  if (agentId === "codex") {
    command = "codex";
    args = [
      "exec",
      "--cd",
      workspace,
      "--skip-git-repo-check",
      "--sandbox",
      "workspace-write",
      "--json",
      "--output-last-message",
      resolve(join(outDir, "raw-transcript", "codex-last-message.md")),
      prompt
    ];
    cwd = process.cwd();
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
  } else if (agentId === "cursor") {
    command = "cursor";
    args = [
      "agent",
      "-p",
      "--output-format",
      "stream-json",
      "--force",
      "--sandbox",
      "disabled",
      "--trust",
      "--workspace",
      workspace,
      prompt
    ];
    cwd = process.cwd();
  } else {
    throw new Error(`No adapter for ${agentId}`);
  }

  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 1024 * 1024 * 96 });
  mkdirSync(dirname(transcriptPath), { recursive: true });
  writeFileSync(transcriptPath, result.stdout || "");
  writeFileSync(stderrPath, result.stderr || "");
  const parsed = parseCommandStats(result.stdout || "", agentId);
  return {
    status: result.status,
    transcriptPath,
    stderrPath,
    transcriptText: result.stdout || "",
    stderrText: result.stderr || "",
    stdoutBytes: Buffer.byteLength(result.stdout || "", "utf8"),
    stderrBytes: Buffer.byteLength(result.stderr || "", "utf8"),
    commandCount: parsed.commandCount,
    failedCommandCount: parsed.failedCommandCount
  };
}

function parseCommandStats(text, agentId) {
  if (!text.trim()) return { commandCount: 0, failedCommandCount: 0 };
  let commandCount = 0;
  let failedCommandCount = 0;
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    try {
      const event = JSON.parse(line);
      if (agentId === "codex" && event.type === "item.completed" && event.item?.type === "command_execution") {
        commandCount += 1;
        if (Number(event.item.exit_code) !== 0) failedCommandCount += 1;
      }
      if (agentId === "claude-code" && /Bash|tool_use|command/i.test(JSON.stringify(event))) {
        commandCount += /Bash|command/i.test(JSON.stringify(event)) ? 1 : 0;
      }
      if (agentId === "cursor" && /command|tool|terminal/i.test(JSON.stringify(event))) {
        commandCount += /command|terminal/i.test(JSON.stringify(event)) ? 1 : 0;
      }
    } catch {
      if (/npm test|node |git |bash|shell|command/i.test(line)) commandCount += 1;
      if (/exit code: [1-9]|failed|error/i.test(line)) failedCommandCount += 1;
    }
  }
  return { commandCount, failedCommandCount };
}

function initGit(workspace) {
  run("git", ["init"], workspace);
  run("git", ["config", "user.email", "ast-bench@example.local"], workspace);
  run("git", ["config", "user.name", "AST-Bench"], workspace);
  run("git", ["add", "."], workspace);
  run("git", ["commit", "-m", "Frozen before state"], workspace);
  return commandOutput("git", ["rev-parse", "HEAD"], workspace).trim();
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout || ""}${result.stderr || ""}`);
}

function commandOutput(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout || "" : "";
}

function countRetrySignals(text) {
  return (text.match(/error|failed|retry|fix|fail/gi) || []).length;
}

function copyIfExists(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, readFileSync(from));
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : "";
}

function agentVersion(agentId) {
  try {
    if (agentId === "codex") return execFileSync("codex", ["--version"], { encoding: "utf8" }).trim();
    if (agentId === "claude-code") return execFileSync("claude", ["--version"], { encoding: "utf8" }).trim();
    if (agentId === "cursor") return execFileSync("cursor", ["agent", "--version"], { encoding: "utf8" }).trim();
  } catch {
    return "unavailable";
  }
  return "unknown";
}
