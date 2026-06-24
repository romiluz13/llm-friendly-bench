#!/usr/bin/env node
// AST-Bench V3 runner — live-DB, de-leaked, 3-lane, model-pinned.
//
// One cell = { shape, lane, agentId, repeat }. Flow:
//   seed live DB (isolated namespace) -> generate de-leaked workspace ->
//   freeze git -> run agent (pinned cheap model) -> live-DB `npm test` ->
//   capture diff/tokens/cheat-signals + db-before/db-after dumps -> teardown.
//
// Usage:
//   node scripts/benchmark-run-v3.mjs --shape moderate --lane mongo --agent claude-code --repeat 1
//   (optional) --model <override>   --scenario <id>   --keep-ns

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { extractUsage } from "./agent-usage.mjs";
import { estimateTokensFromBytes, hashExisting, writeJson, writeText } from "./benchmark-lib.mjs";
import { LANES, namespace, seed, dump, teardown } from "./benchmark-livedb.mjs";
import { writeV3Workspace } from "./benchmark-workspace-v3.mjs";
import { PRIMARY_SCENARIO, NEGATIVE_CONTROLS, deriveExpected } from "./benchmark-derive.mjs";

// Cheap-model defaults for the smoke (config.toml defaults Codex to gpt-5.5,
// and Claude inherits the session model — so we pin both explicitly here).
// Claude resolves "claude-sonnet-4-6" only via the alias "sonnet" on this
// Bedrock backend (the literal id 400s); Codex takes the grove model id directly.
const MODEL = {
  "claude-code": process.env.ASTBENCH_CLAUDE_MODEL || "sonnet",
  "codex": process.env.ASTBENCH_CODEX_MODEL || "gpt-5.4-mini"
};

const SHAPES = ["shallow", "moderate", "deep"];
const AGENTS = ["claude-code", "codex"];
const RUN_ROOT = "benchmark/runs-v3";

// Anti-cheat contract constants (declared at module top so detectCheatSignals,
// which runs during the CLI entrypoint below, never hits a temporal-dead-zone).
// The agent's ONLY allowed edit is src/workflow.mjs. Editing protected files
// (e.g. adding a file fallback to src/db.mjs, or weakening tests/) is a cheat.
const PROTECTED_PREFIXES = ["tests/", "data/"];
const PROTECTED_FILES = ["src/db.mjs", "tests/facts.mjs", "package.json", "RULES.md", "db-config.json"];
const FALLBACK_PATTERNS = [
  /seed\.json|db-before|\.snapshot|live-snapshot/i,
  /in-?memory|localDb|LocalDb|fallback\s*(db|database|store)/i
];

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const shape = valueAfter("--shape") || "moderate";
  const lane = valueAfter("--lane");
  const agentId = valueAfter("--agent");
  const repeat = Number(valueAfter("--repeat") || 1);
  const modelOverride = valueAfter("--model") || "";
  const scenarioId = valueAfter("--scenario") || PRIMARY_SCENARIO.id;
  const keepNs = process.argv.includes("--keep-ns");

  if (!SHAPES.includes(shape)) fail(`--shape must be one of ${SHAPES.join(", ")}`);
  if (!LANES.includes(lane)) fail(`--lane must be one of ${LANES.join(", ")}`);
  if (!AGENTS.includes(agentId)) fail(`--agent must be one of ${AGENTS.join(", ")}`);
  if (repeat < 1) fail("--repeat must be >= 1");

  const result = runCellV3({ shape, lane, agentId, repeat, model: modelOverride || MODEL[agentId], scenarioId, keepNs });
  console.log(`AST-Bench V3 ${result.status}: ${shape}/${lane}/${agentId}/r${repeat} model=${result.model} tokensRead=${result.tokensRead}`);
  if (result.status !== "passed") process.exitCode = 1;
}

export function runCellV3({ shape, lane, agentId, repeat, model, scenarioId = PRIMARY_SCENARIO.id, keepNs = false }) {
  // Default the model HERE so every caller (CLI + batch) is safe; passing
  // model:undefined must never reach the agent as "--model undefined" (400).
  model = model || MODEL[agentId];
  const scenario = scenarioId === PRIMARY_SCENARIO.id
    ? PRIMARY_SCENARIO
    : NEGATIVE_CONTROLS.find((s) => s.id === scenarioId) || PRIMARY_SCENARIO;
  const expected = deriveExpected(scenario);
  const ns = namespace({ shape, lane, agentId, repeat });
  const outDir = join(RUN_ROOT, shape, lane, agentId, `repeat-${repeat}`);
  const workspace = join(outDir, "workspace");

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, "raw-transcript"), { recursive: true });
  mkdirSync(join(outDir, "db-before"), { recursive: true });
  mkdirSync(join(outDir, "db-after"), { recursive: true });

  // 1) seed live DB + 2) generate de-leaked workspace
  const dbHandle = seed({ world: scenario, shape, lane, ns });
  writeV3Workspace({ workspace, lane, shape, ns, dbHandle, scenarioId });
  writeText(join(outDir, "db-before", "seed.json"), dump({ lane, ns }));

  const prompt = buildPrompt({ lane });
  writeText(join(outDir, "prompt.md"), prompt);

  // 3) freeze git (for honest diff vs. agent's own commits)
  const frozenSha = initGit(workspace);
  const startedAt = new Date();
  const startMs = Date.now();

  // 4) run the pinned-model agent
  const agentResult = runAgent({ agentId, workspace, prompt, outDir, model });

  // 5) live-DB-backed acceptance
  const test = spawnSync("npm", ["test"], { cwd: workspace, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  writeText(join(outDir, "tests.log"), `${test.stdout || ""}${test.stderr || ""}`);

  // 6) capture db-after, diff, cheat signals, tokens
  writeText(join(outDir, "db-after", "final.json"), safeDump(lane, ns));
  const diff = commandOutput("git", frozenSha ? ["diff", frozenSha, "--", "."] : ["diff", "--", "."], workspace);
  writeText(join(outDir, "diff.patch"), diff);
  const changedFiles = commandOutput("git", frozenSha ? ["diff", "--name-only", frozenSha, "--", "."] : ["diff", "--name-only", "--", "."], workspace)
    .split(/\r?\n/).filter(Boolean);
  const cheatSignals = detectCheatSignals(changedFiles, (f) => { try { return readFileSync(join(workspace, f), "utf8"); } catch { return ""; } });
  const usage = extractUsage(agentId, agentResult.transcriptText);
  const transcriptBytes = (agentResult.stdoutBytes || 0) + (agentResult.stderrBytes || 0);

  // Live-DB integrity (agent-code-INDEPENDENT): read the output tables straight
  // from the real DB namespace and confirm the agent actually persisted there.
  // A file-fallback cheat leaves the live output tables empty even if `npm test`
  // (which the agent could have pointed at a local file) printed "passed".
  const liveOutput = verifyLiveWrite(lane, ns);

  let status = agentResult.status === 0 && test.status === 0 ? "passed" : "failed";
  if (cheatSignals.length > 0) status = "failed";
  // For qualifying scenarios the live DB MUST contain the persisted workflow.
  if (status === "passed" && expected.expectsEscalation && !liveOutput.liveDbWritten) {
    status = "failed";
    cheatSignals.push("live-db-not-written");
  }

  const manifest = {
    schemaVersion: "3.0.0",
    suiteId: "ast-bench-v3",
    executionMode: "live-db",
    dbNamespace: ns,
    scenarioId,
    expectsEscalation: expected.expectsEscalation,
    shape, lane, agentId, repeat,
    model,
    agentVersion: agentVersion(agentId),
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
      dbBefore: join(outDir, "db-before", "seed.json"),
      dbAfter: join(outDir, "db-after", "final.json")
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
      liveDbWritten: liveOutput.liveDbWritten,
      liveStateRows: liveOutput.liveStateRows ?? 0,
      liveTaskRows: liveOutput.liveTaskRows ?? 0,
      retrySignals: countRetrySignals(`${agentResult.transcriptText}\n${agentResult.stderrText}\n${test.stdout || ""}\n${test.stderr || ""}`),
      testStatus: test.status === 0 ? "passed" : "failed",
      agentExitCode: agentResult.status,
      testsExitCode: test.status
    },
    evidenceSha256: hashExisting([
      join(outDir, "prompt.md"),
      agentResult.transcriptPath,
      join(outDir, "diff.patch"),
      join(outDir, "tests.log"),
      join(outDir, "db-before", "seed.json"),
      join(outDir, "db-after", "final.json")
    ])
  };

  writeJson(join(outDir, "run-manifest.json"), manifest);
  if (!keepNs) teardown({ lane, ns });
  return { status, model, tokensRead: usage.tokensRead, outDir };
}

function buildPrompt({ lane }) {
  return `You are running AST-Bench V3, a live-database coding benchmark.

Your job: implement \`src/workflow.mjs\` so it connects to the live ${lane} database
described in \`db-config.json\`, reads the account's raw facts, DERIVES the rescue
workflow exactly per \`RULES.md\`, and PERSISTS the result back to the live database
(workflow_state, owner_tasks, customer_messages, audit_events).

Then run \`npm test\` until it passes. The test connects to the live database and
checks your persisted state against the rules.

Rules:
- The answer is NOT in the data. Derive status, owners, risk signals from raw facts per RULES.md.
- Connect to the real database (see db-config.json + src/db.mjs). Do not use a flat file as the database.
- Edit ONLY src/workflow.mjs. Do NOT modify src/db.mjs, tests/, db-config.json, or the seeded data.
  src/db.mjs already connects to the live database — import withDb from it as-is.
- Do NOT add any file-based or in-memory fallback. If the database connection fails, let it fail.
- Make the smallest correct production-style change.`;
}

function runAgent({ agentId, workspace, prompt, outDir, model }) {
  if (!model) throw new Error(`runAgent: missing model for ${agentId}`);
  const transcriptPath = join(outDir, "raw-transcript", `${agentId}.jsonl`);
  const stderrPath = join(outDir, "raw-transcript", `${agentId}-stderr.log`);
  let command, args, cwd = workspace;

  if (agentId === "codex") {
    command = "codex";
    args = ["exec", "--cd", workspace, "--skip-git-repo-check", "--sandbox", "workspace-write",
      "-c", `model=${JSON.stringify(model)}`,
      "--json", "--output-last-message", resolve(join(outDir, "raw-transcript", "codex-last-message.md")), prompt];
    cwd = process.cwd();
  } else if (agentId === "claude-code") {
    command = "claude";
    args = ["-p", "--output-format", "stream-json", "--verbose", "--model", model,
      "--permission-mode", "bypassPermissions", prompt];
  } else {
    throw new Error(`No adapter for ${agentId}`);
  }

  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 96 * 1024 * 1024 });
  mkdirSync(dirname(transcriptPath), { recursive: true });
  writeFileSync(transcriptPath, result.stdout || "");
  writeFileSync(stderrPath, result.stderr || "");
  return {
    status: result.status, transcriptPath, stderrPath,
    transcriptText: result.stdout || "", stderrText: result.stderr || "",
    stdoutBytes: Buffer.byteLength(result.stdout || "", "utf8"),
    stderrBytes: Buffer.byteLength(result.stderr || "", "utf8")
  };
}

// Anti-cheat for V3. The agent's ONLY allowed edit is src/workflow.mjs.
export function detectCheatSignals(changedFiles, readFileFn) {
  const signals = [];
  for (const file of changedFiles) {
    if (PROTECTED_FILES.includes(file) || PROTECTED_PREFIXES.some((p) => file.startsWith(p))) {
      signals.push("protected-file-modified");
      continue; // its content is moot — the edit itself is the violation
    }
    const text = readFileFn(file) || "";
    if (/\bglobalThis\.\w+\s*=|\bglobal\.\w+\s*=/.test(text)) signals.push("global-injection");
    if (FALLBACK_PATTERNS.some((re) => re.test(text))) signals.push("file-fallback-db");
  }
  return [...new Set(signals)];
}

function safeDump(lane, ns) { try { return dump({ lane, ns }); } catch (e) { return JSON.stringify({ dumpError: e.message }); } }

// Agent-code-independent live-DB check: dump the real namespace and confirm the
// agent persisted workflow_state + owner_tasks THERE (not into a local file).
function verifyLiveWrite(lane, ns) {
  try {
    const data = JSON.parse(dump({ lane, ns }));
    const stateRows = (data.workflow_state || []).length;
    const taskRows = (data.owner_tasks || []).length;
    return { liveDbWritten: stateRows >= 1 && taskRows >= 1, liveStateRows: stateRows, liveTaskRows: taskRows };
  } catch (e) {
    return { liveDbWritten: false, error: e.message };
  }
}
function initGit(workspace) {
  run("git", ["init"], workspace);
  run("git", ["config", "user.email", "ast-bench@example.local"], workspace);
  run("git", ["config", "user.name", "AST-Bench"], workspace);
  // don't commit the node_modules symlink contents
  writeFileSync(join(workspace, ".gitignore"), "node_modules\n");
  run("git", ["add", "."], workspace);
  run("git", ["commit", "-m", "Frozen before state", "--no-verify"], workspace);
  return commandOutput("git", ["rev-parse", "HEAD"], workspace).trim();
}
function run(command, args, cwd) {
  const r = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${command} ${args.join(" ")} failed\n${r.stdout || ""}${r.stderr || ""}`);
}
function commandOutput(command, args, cwd) {
  const r = spawnSync(command, args, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout || "" : "";
}
function countRetrySignals(text) { return (text.match(/error|failed|retry|fix|fail/gi) || []).length; }
function agentVersion(agentId) {
  try {
    if (agentId === "codex") return execFileSync("codex", ["--version"], { encoding: "utf8" }).trim();
    if (agentId === "claude-code") return execFileSync("claude", ["--version"], { encoding: "utf8" }).trim();
  } catch { return "unavailable"; }
  return "unknown";
}
function valueAfter(flag) { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : ""; }
function fail(msg) { console.error(msg); process.exit(1); }
