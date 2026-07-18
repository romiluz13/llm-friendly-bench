#!/usr/bin/env node
// Build-Bench brownfield runner — schema-evolution against existing schema + code.
//
// One cell = { taskType, lane, agentId, repeat }. Flow:
//   create empty namespace -> seed existing schema + data -> generate brownfield
//   workspace (existing code + change request) -> freeze git -> run agent ->
//   live-DB acceptance (regression + new field) -> capture -> teardown.
//
// Usage:
//   node scripts/benchmark-run-brownfield.mjs --lane mongo --agent codex --repeat 1

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { extractUsage } from "./agent-usage.mjs";
import {
	estimateTokensFromBytes,
	hashExisting,
	writeJson,
	writeText,
} from "./benchmark-lib.mjs";
import { writeBrownfieldWorkspace } from "./benchmark-workspace-brownfield.mjs";

const MODEL = {
	"claude-code": process.env.ASTBENCH_CLAUDE_MODEL || "sonnet",
	codex: process.env.ASTBENCH_CODEX_MODEL || "gpt-5.6-terra",
};

const AGENTS = ["claude-code", "codex"];
const LANES = ["mongo", "postgres-norm", "postgres-jsonb"];
const TASK_TYPE = "schema-evolution";
const RUN_ROOT = "benchmark/runs-brownfield";

const PROTECTED_PREFIXES = ["tests/", "data/"];
const PROTECTED_FILES = [
	"src/db.mjs",
	"package.json",
	"RULES.md",
	"db-config.json",
	"AGENTS.md",
	"README.md",
];
const FALLBACK_PATTERNS = [
	/seed\.json|db-before|\.snapshot|live-snapshot/i,
	/in-?memory|localDb|LocalDb|fallback\s*(db|database|store)/i,
];
const TEST_STUB_PATTERNS = [
	/process\.env\.NODE_ENV\s*===?\s*['"]test['"]/i,
	/createMockDb|mock-mongo|jest-mongo|mockingoose/i,
	/MockClient|mockClient|fakeDb|FakeDb/i,
];

if (process.argv[1] === new URL(import.meta.url).pathname) {
	const lane = valueAfter("--lane") || "mongo";
	const agentId = valueAfter("--agent");
	const repeat = Number(valueAfter("--repeat") || 1);
	const modelOverride = valueAfter("--model") || "";
	const keepNs = process.argv.includes("--keep-ns");

	if (!LANES.includes(lane)) fail(`--lane must be one of ${LANES.join(", ")}`);
	if (!AGENTS.includes(agentId))
		fail(`--agent must be one of ${AGENTS.join(", ")}`);
	if (repeat < 1) fail("--repeat must be >= 1");

	const result = runCellBrownfield({
		lane,
		agentId,
		repeat,
		model: modelOverride || MODEL[agentId],
		keepNs,
	});
	console.log(
		`Build-Bench brownfield ${result.status}: ${TASK_TYPE}/${lane}/${agentId}/r${repeat} model=${result.model} tokensRead=${result.tokensRead}`,
	);
	if (result.status !== "passed") process.exitCode = 1;
}

export function runCellBrownfield({
	lane,
	agentId,
	repeat,
	model,
	keepNs = false,
}) {
	model = model || MODEL[agentId];
	const ns = `buildbench_brownfield_${lane}_${agentId}_r${repeat}`;
	const outDir = join(RUN_ROOT, TASK_TYPE, lane, agentId, `repeat-${repeat}`);
	const workspace = join(outDir, "workspace");
	const dbHandle = dbHandleFor(lane, ns);

	rmSync(outDir, { recursive: true, force: true });
	mkdirSync(join(outDir, "raw-transcript"), { recursive: true });
	mkdirSync(join(outDir, "db-before"), { recursive: true });
	mkdirSync(join(outDir, "db-after"), { recursive: true });

	// 1) create empty namespace (the existing schema will be created by the workspace code)
	dropNs(lane, ns);
	writeText(
		join(outDir, "db-before", "seed.json"),
		JSON.stringify({
			ns,
			state: "empty (brownfield — existing code creates schema)",
		}),
	);

	// 2) generate brownfield workspace (existing code + change request)
	writeBrownfieldWorkspace({
		workspace,
		lane,
		taskType: TASK_TYPE,
		ns,
		dbHandle,
	});

	const prompt = buildPrompt({ lane });
	writeText(join(outDir, "prompt.md"), prompt);

	// 3) freeze git
	const frozenSha = initGit(workspace);
	const startedAt = new Date();
	const startMs = Date.now();

	// 4) run the pinned-model agent
	const agentResult = runAgent({ agentId, workspace, prompt, outDir, model });

	// 5) live-DB-backed acceptance
	const test = spawnSync("npm", ["test"], {
		cwd: workspace,
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
	});
	writeText(
		join(outDir, "tests.log"),
		`${test.stdout || ""}${test.stderr || ""}`,
	);

	// 6) capture db-after, diff, cheat signals, tokens
	const dbAfter = dumpNs(lane, ns);
	writeText(
		join(outDir, "db-after", "final.json"),
		JSON.stringify(dbAfter, null, 2),
	);
	const diff = commandOutput(
		"git",
		frozenSha ? ["diff", frozenSha, "--", "."] : ["diff", "--", "."],
		workspace,
	);
	writeText(join(outDir, "diff.patch"), diff);
	const changedFiles = commandOutput(
		"git",
		frozenSha
			? ["diff", "--name-only", frozenSha, "--", "."]
			: ["diff", "--name-only", "--", "."],
		workspace,
	)
		.split(/\r?\n/)
		.filter(Boolean);
	const cheatSignals = detectCheatSignals(changedFiles, (f) => {
		try {
			return readFileSync(join(workspace, f), "utf8");
		} catch {
			return "";
		}
	});
	const usage = extractUsage(agentId, agentResult.transcriptText);
	const transcriptBytes =
		(agentResult.stdoutBytes || 0) + (agentResult.stderrBytes || 0);

	// 7) live-DB verification: does the accounts table/collection exist with the new field?
	const liveOutput = verifyLiveWrite(lane, ns);

	let status = test.status === 0 ? "passed" : "failed";
	if (cheatSignals.length > 0) status = "failed";
	if (status === "passed" && !liveOutput.liveDbWritten) {
		status = "failed";
		cheatSignals.push("live-db-not-written");
	}

	const manifest = {
		schemaVersion: "1.0.0",
		suiteId: "build-bench-brownfield",
		executionMode: "live-db",
		dbNamespace: ns,
		taskType: TASK_TYPE,
		lane,
		agentId,
		repeat,
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
			dbAfter: join(outDir, "db-after", "final.json"),
		},
		metrics: {
			elapsedMs: Date.now() - startMs,
			transcriptBytes,
			tokens: usage,
			estimatedTranscriptTokens:
				usage.source === "measured"
					? usage.totalTokens
					: estimateTokensFromBytes(transcriptBytes),
			diffBytes: Buffer.byteLength(diff, "utf8"),
			filesChanged: changedFiles.length,
			changedFiles,
			cheatSignals,
			liveDbWritten: liveOutput.liveDbWritten,
			fieldExists: liveOutput.fieldExists,
			retrySignals: countRetrySignals(
				`${agentResult.transcriptText}\n${agentResult.stderrText}\n${test.stdout || ""}\n${test.stderr || ""}`,
			),
			testStatus: test.status === 0 ? "passed" : "failed",
			agentExitCode: agentResult.status,
			testsExitCode: test.status,
			timedOut: agentResult.timedOut,
		},
		evidenceSha256: hashExisting([
			join(outDir, "prompt.md"),
			agentResult.transcriptPath,
			join(outDir, "diff.patch"),
			join(outDir, "tests.log"),
			join(outDir, "db-before", "seed.json"),
			join(outDir, "db-after", "final.json"),
		]),
	};

	writeJson(join(outDir, "run-manifest.json"), manifest);
	if (!keepNs) dropNs(lane, ns);
	return { status, model, tokensRead: usage.tokensRead, outDir };
}

function dbHandleFor(lane, ns) {
	if (lane === "mongo") return { uri: "mongodb://127.0.0.1:27018/?directConnection=true", db: ns };
	return {
		host: "127.0.0.1",
		port: 5433,
		user: "lab",
		password: "lab",
		database: "sql_hidden_cost",
		schema: ns,
	};
}

function buildPrompt({ lane }) {
	const isMongo = lane === "mongo";
	const schemaNoun = isMongo ? "collection validator" : "table schema";
	return `You are running Build-Bench Brownfield, a live-database coding benchmark.

The database has an EXISTING accounts entity with working CRUD code in \`src/schema.mjs\`
and \`src/accounts.mjs\`. Read them first — the code already works.

Your task: ADD a **riskScore** field (integer, 0-100, optional) to the accounts entity.

Steps:
1. Read \`src/schema.mjs\` and \`src/accounts.mjs\` to understand the existing schema and code.
2. Update \`src/schema.mjs\` to include the new field in the ${schemaNoun}.
3. Update \`src/accounts.mjs\` to handle riskScore in create/get/update.
4. Run \`npm test\` until it passes. The test checks BOTH:
   - Regression: existing CRUD still works (create/get/update/delete WITHOUT riskScore)
   - New: create WITH riskScore, get returns riskScore, update riskScore

Rules:
- Do NOT break existing functionality — the regression tests must pass.
- Connect to the real database via \`src/db.mjs\` (do NOT edit this file).
- Edit files under \`src/\` EXCEPT \`src/db.mjs\`. Do NOT modify anything under \`tests/\`.
- Do NOT add any file-based or in-memory fallback.
- Make the smallest correct change — evolve the existing code, don't rewrite it.
- Do NOT read skill files, run code reviews, or launch subagents. Just do the task directly.
- Do NOT read any files outside this workspace directory.`;
}

function runAgent({ agentId, workspace, prompt, outDir, model }) {
	if (!model) throw new Error(`runAgent: missing model for ${agentId}`);
	const transcriptPath = join(outDir, "raw-transcript", `${agentId}.jsonl`);
	const stderrPath = join(outDir, "raw-transcript", `${agentId}-stderr.log`);
	let command,
		args,
		cwd = workspace;

	if (agentId === "codex") {
		command = "codex";
		args = [
			"exec",
			"--cd",
			workspace,
			"--skip-git-repo-check",
			"--sandbox",
			"danger-full-access",
			"-c",
			`model=${JSON.stringify(model)}`,
			"-c",
			"model_reasoning_effort=low",
			"--disable",
			"memories",
			"--json",
			"--output-last-message",
			resolve(join(outDir, "raw-transcript", "codex-last-message.md")),
			prompt,
		];
		cwd = process.cwd();
	} else if (agentId === "claude-code") {
		command = "claude";
		args = [
			"-p",
			"--output-format",
			"stream-json",
			"--verbose",
			"--model",
			model,
			"--permission-mode",
			"bypassPermissions",
			prompt,
		];
	} else {
		throw new Error(`No adapter for ${agentId}`);
	}

	const AGENT_TIMEOUT_MS = Number(
		process.env.ASTBENCH_AGENT_TIMEOUT_MS || 15 * 60 * 1000,
	);
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		maxBuffer: 96 * 1024 * 1024,
		timeout: AGENT_TIMEOUT_MS,
		killSignal: "SIGKILL",
	});
	mkdirSync(dirname(transcriptPath), { recursive: true });
	writeFileSync(transcriptPath, result.stdout || "");
	writeFileSync(stderrPath, result.stderr || "");
	const timedOut = result.error && result.error.code === "ETIMEDOUT";
	return {
		status: timedOut ? 124 : result.status,
		transcriptPath,
		stderrPath,
		timedOut: Boolean(timedOut),
		transcriptText: result.stdout || "",
		stderrText: result.stderr || "",
		stdoutBytes: Buffer.byteLength(result.stdout || "", "utf8"),
		stderrBytes: Buffer.byteLength(result.stderr || "", "utf8"),
	};
}

export function detectCheatSignals(changedFiles, readFileFn) {
	const signals = [];
	for (const file of changedFiles) {
		if (
			PROTECTED_FILES.includes(file) ||
			PROTECTED_PREFIXES.some((p) => file.startsWith(p))
		) {
			signals.push("protected-file-modified");
			continue;
		}
		const text = readFileFn(file) || "";
		if (/\bglobalThis\.\w+\s*=|\bglobal\.\w+\s*=/.test(text))
			signals.push("global-injection");
		if (FALLBACK_PATTERNS.some((re) => re.test(text)))
			signals.push("file-fallback-db");
		if (TEST_STUB_PATTERNS.some((re) => re.test(text)))
			signals.push("test-stub-db");
	}
	return [...new Set(signals)];
}

// Live-DB verification: does the accounts table/collection exist?
function verifyLiveWrite(lane, ns) {
	if (lane === "mongo") {
		try {
			const result = execSync(
				`mongosh --quiet mongodb://127.0.0.1:27018/${ns}?directConnection=true --eval 'JSON.stringify(db.getCollectionNames())'`,
				{ encoding: "utf8", timeout: 10000 },
			);
			const collections = JSON.parse(result.trim());
			const exists = collections.includes("accounts");
			return { liveDbWritten: exists, fieldExists: exists };
		} catch (e) {
			return { liveDbWritten: false, fieldExists: false, error: e.message };
		}
	} else {
		try {
			const result = execSync(
				`docker exec sql-hidden-cost-postgres psql -U lab -d sql_hidden_cost -t -A -c "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='${ns}' AND tablename='accounts')"`,
				{ encoding: "utf8", timeout: 10000 },
			);
			const exists = result.trim() === "t";
			return { liveDbWritten: exists, fieldExists: exists };
		} catch (e) {
			return { liveDbWritten: false, fieldExists: false, error: e.message };
		}
	}
}

function dropNs(lane, ns) {
	if (lane === "mongo") {
		try {
			execSync(
				`mongosh --quiet mongodb://127.0.0.1:27018/${ns}?directConnection=true --eval 'db.dropDatabase()'`,
				{ stdio: "pipe", timeout: 10000 },
			);
		} catch {
			/* ns may not exist */
		}
	} else {
		try {
			execSync(
				`docker exec sql-hidden-cost-postgres psql -U lab -d sql_hidden_cost -c 'DROP SCHEMA IF EXISTS "${ns}" CASCADE; CREATE SCHEMA "${ns}";'`,
				{ stdio: "pipe", timeout: 10000 },
			);
		} catch {
			/* ns may not exist */
		}
	}
}

function dumpNs(lane, ns) {
	if (lane === "mongo") {
		try {
			const result = execSync(
				`mongosh --quiet mongodb://127.0.0.1:27018/${ns}?directConnection=true --eval 'JSON.stringify({collections: db.getCollectionNames().map(n => ({name: n, count: db.getCollection(n).countDocuments()}))})'`,
				{ encoding: "utf8", timeout: 10000 },
			);
			return JSON.parse(result.trim());
		} catch (e) {
			return { dumpError: e.message };
		}
	} else {
		try {
			const result = execSync(
				`docker exec sql-hidden-cost-postgres psql -U lab -d sql_hidden_cost -t -A -c "SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT tablename as name FROM pg_tables WHERE schemaname='${ns}') t"`,
				{ encoding: "utf8", timeout: 10000 },
			);
			return { collections: JSON.parse(result.trim()) };
		} catch (e) {
			return { dumpError: e.message };
		}
	}
}

function initGit(workspace) {
	run("git", ["init"], workspace);
	run("git", ["config", "user.email", "build-bench@example.local"], workspace);
	run("git", ["config", "user.name", "Build-Bench"], workspace);
	writeFileSync(join(workspace, ".gitignore"), "node_modules\n");
	run("git", ["add", "."], workspace);
	run("git", ["commit", "-m", "Frozen before state", "--no-verify"], workspace);
	return commandOutput("git", ["rev-parse", "HEAD"], workspace).trim();
}

function run(command, args, cwd) {
	const r = spawnSync(command, args, { cwd, encoding: "utf8" });
	if (r.status !== 0)
		throw new Error(
			`${command} ${args.join(" ")} failed\n${r.stdout || ""}${r.stderr || ""}`,
		);
}

function commandOutput(command, args, cwd) {
	const r = spawnSync(command, args, { cwd, encoding: "utf8" });
	return r.status === 0 ? r.stdout || "" : "";
}

function countRetrySignals(text) {
	return (text.match(/error|failed|retry|fix|fail/gi) || []).length;
}

function agentVersion(agentId) {
	try {
		if (agentId === "codex")
			return execFileSync("codex", ["--version"], { encoding: "utf8" }).trim();
		if (agentId === "claude-code")
			return execFileSync("claude", ["--version"], { encoding: "utf8" }).trim();
	} catch {
		return "unavailable";
	}
	return "unknown";
}

function valueAfter(flag) {
	const i = process.argv.indexOf(flag);
	return i >= 0 ? process.argv[i + 1] : "";
}
function fail(msg) {
	console.error(msg);
	process.exit(1);
}
