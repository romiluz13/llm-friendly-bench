#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { writeJson } from "./proof-fixtures.mjs";

const runId = process.env.RUN_ID || "order-exception-codex-v1";
const lane = process.argv[2];

if (!["mongo", "postgres"].includes(lane)) {
  throw new Error("Usage: node scripts/run-instrumented-codex.mjs [mongo|postgres]");
}

const runDir = join("instrumented-agent-runs", runId, lane);
const workspaceDir = join(runDir, "workspace");
const promptPath = join(runDir, "prompt.md");
const transcriptPath = join(runDir, "raw-transcript", "codex-events.jsonl");
const stderrPath = join(runDir, "raw-transcript", "codex-stderr.log");
const lastMessagePath = join(runDir, "raw-transcript", "codex-last-message.md");

if (process.env.SKIP_PREPARE !== "1" || !existsSync(workspaceDir) || !existsSync(promptPath)) {
  spawnChecked(process.execPath, ["scripts/prepare-instrumented-run.mjs", lane]);
}

const startedAt = new Date();
const startMs = Date.now();
const prompt = readFileSync(promptPath, "utf8");

const result = spawnSync("codex", [
  "exec",
  "--cd",
  workspaceDir,
  "--skip-git-repo-check",
  "--sandbox",
  "workspace-write",
  "--json",
  "--output-last-message",
  resolve(lastMessagePath),
  prompt
], {
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 64
});

mkdirSync(join(runDir, "raw-transcript"), { recursive: true });
writeFileSync(transcriptPath, result.stdout || "");
writeFileSync(stderrPath, result.stderr || "");

const finishedAt = new Date();
const tests = spawnSync("npm", ["test"], { cwd: workspaceDir, encoding: "utf8" });
writeFileSync(join(runDir, "tests.log"), `${tests.stdout || ""}${tests.stderr || ""}`);

if (tests.status === 0) {
  const render = spawnSync("npm", ["run", "render"], { cwd: workspaceDir, encoding: "utf8" });
  writeFileSync(join(runDir, "render.log"), `${render.stdout || ""}${render.stderr || ""}`);
  copyIfExists(join(workspaceDir, "artifacts", "customer-portal-before-after.json"), join(runDir, "acceptance.json"));
  copyIfExists(join(workspaceDir, "artifacts", "customer-portal-before-after.svg"), join(runDir, "screenshots", "customer-portal-before-after.svg"));
  copyIfExists(join(workspaceDir, "artifacts", "customer-portal-before-after.json"), join(runDir, "db-after", `${lane}-portal-after.json`));
}

const diff = commandOutput("git", ["diff", "--", "."], workspaceDir);
writeFileSync(join(runDir, "diff.patch"), diff);

const changedFiles = commandOutput("git", ["diff", "--name-only", "--", "."], workspaceDir)
  .split(/\r?\n/)
  .filter(Boolean);
const transcriptBytes = Buffer.byteLength(result.stdout || "", "utf8") + Buffer.byteLength(result.stderr || "", "utf8");
const diffBytes = Buffer.byteLength(diff, "utf8");
const manifest = {
  ...readManifest(),
  status: result.status === 0 && tests.status === 0 ? "passed" : "failed",
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  agent: {
    name: "Codex",
    cliVersion: codexVersion(),
    mode: "codex exec",
    model: "default Codex CLI profile"
  },
  artifacts: {
    workspace: workspaceDir,
    prompt: promptPath,
    rawTranscript: transcriptPath,
    stderr: stderrPath,
    lastMessage: lastMessagePath,
    diff: join(runDir, "diff.patch"),
    tests: join(runDir, "tests.log"),
    acceptance: join(runDir, "acceptance.json"),
    screenshot: join(runDir, "screenshots", "customer-portal-before-after.svg")
  },
  metrics: {
    elapsedMs: Date.now() - startMs,
    transcriptBytes,
    estimatedTranscriptTokens: Math.ceil(transcriptBytes / 4),
    diffBytes,
    filesChanged: changedFiles.length,
    changedFiles,
    testStatus: tests.status === 0 ? "passed" : "failed",
    retrySignals: countRetrySignals(`${result.stdout || ""}\n${result.stderr || ""}\n${tests.stdout || ""}\n${tests.stderr || ""}`),
    codexExitCode: result.status,
    testsExitCode: tests.status,
    evidenceSha256: hashFiles([
      transcriptPath,
      stderrPath,
      join(runDir, "diff.patch"),
      join(runDir, "tests.log"),
      join(runDir, "acceptance.json"),
      join(runDir, "screenshots", "customer-portal-before-after.svg")
    ])
  }
};

writeJson(join(runDir, "run-manifest.json"), manifest);

if (manifest.status !== "passed") {
  console.error(`${lane} Codex run failed. See ${runDir}`);
  process.exit(1);
}

console.log(`${lane} Codex run passed: ${runDir}`);

function readManifest() {
  const manifestPath = join(runDir, "run-manifest.json");
  if (!existsSync(manifestPath)) return {};
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function codexVersion() {
  try {
    return execFileSync("codex", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return "codex unavailable";
  }
}

function countRetrySignals(text) {
  return (text.match(/error|failed|retry|fix|fail/gi) || []).length;
}

function commandOutput(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) return "";
  return result.stdout || "";
}

function copyIfExists(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, readFileSync(from));
}

function hashFiles(paths) {
  return paths
    .filter((path) => existsSync(path))
    .map((path) => ({
      path,
      sha256: createHash("sha256").update(readFileSync(path)).digest("hex")
    }));
}

function spawnChecked(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout || ""}${result.stderr || ""}`);
  }
}
