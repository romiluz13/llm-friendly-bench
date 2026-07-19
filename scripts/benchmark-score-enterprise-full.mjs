// Build-Bench enterprise scoring — reads manifests, computes medians + IQR,
// within-agent deltas, and marks hypotheses for schema-evolution-enterprise.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { median, writeJson } from "./benchmark-lib.mjs";

const TASK_TYPE = "schema-evolution-enterprise";
const RUN_ROOT = "benchmark/runs-enterprise-full";
const OUT = join(RUN_ROOT, "summary.json");
const LANES = ["mongo", "postgres-norm", "postgres-jsonb"];
const AGENTS = ["claude-code", "codex"];

export function isCleanComplex(m) {
	if (!m) return false;
	return (
		m.status === "passed" &&
		m.metrics?.liveDbWritten === true &&
		(m.metrics?.cheatSignals?.length || 0) === 0
	);
}

function manifestsFor(agentId, lane) {
	const out = [];
	for (let repeat = 1; repeat <= 20; repeat += 1) {
		const p = join(
			RUN_ROOT,
			TASK_TYPE,
			lane,
			agentId,
			`repeat-${repeat}`,
			"run-manifest.json",
		);
		if (!existsSync(p)) continue;
		try {
			out.push(JSON.parse(readFileSync(p, "utf8")));
		} catch {
			/* ignore */
		}
	}
	return out;
}

function iqr(values) {
	const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
	if (!sorted.length) return 0;
	const q1 = sorted[Math.floor(sorted.length * 0.25)];
	const q3 = sorted[Math.floor(sorted.length * 0.75)];
	return q3 - q1;
}

function laneStats(agentId, lane) {
	const tok = [],
		time = [],
		retries = [],
		diffBytes = [],
		filesTouched = [];
	let totalRepeats = 0;
	for (const m of manifestsFor(agentId, lane)) {
		totalRepeats += 1;
		if (!isCleanComplex(m)) continue;
		tok.push(m.metrics.tokens.tokensRead);
		time.push(m.metrics.elapsedMs);
		retries.push(m.metrics.retrySignals || 0);
		diffBytes.push(m.metrics.diffBytes || 0);
		filesTouched.push(m.metrics.filesChanged || 0);
	}
	return {
		cleanRepeats: tok.length,
		totalRepeats,
		failCount: totalRepeats - tok.length,
		medianTokensRead: median(tok),
		iqrTokensRead: iqr(tok),
		medianElapsedMs: median(time),
		medianRetrySignals: median(retries),
		medianDiffBytes: median(diffBytes),
		medianFilesChanged: median(filesTouched),
	};
}

function pct(base, v) {
	if (!base || !Number.isFinite(base) || base === 0) return null;
	return Math.round(((v - base) / base) * 100);
}

function scoreAgent(agentId) {
	const lanes = {};
	for (const lane of LANES) lanes[lane] = laneStats(agentId, lane);
	const baseTok = lanes.mongo.medianTokensRead;
	const vsMongo = {};
	for (const lane of ["postgres-norm", "postgres-jsonb"]) {
		vsMongo[lane] = {
			tokensPct: pct(baseTok, lanes[lane].medianTokensRead),
			medianTokensRead: lanes[lane].medianTokensRead,
		};
	}
	return { agentId, lanes, vsMongo };
}

function markHypothesis(agents) {
	// H1: MongoDB requires less agent work (tokensRead) than any relational lane.
	const h1Results = agents.map(
		(a) =>
			a.vsMongo["postgres-norm"].tokensPct != null &&
			a.vsMongo["postgres-norm"].tokensPct > 0 &&
			a.vsMongo["postgres-jsonb"].tokensPct != null &&
			a.vsMongo["postgres-jsonb"].tokensPct > 0,
	);
	const h1Confirmed = h1Results.every(Boolean);
	const h1Refuted =
		h1Results.every((b) => !b && b != null) && h1Results.length > 0;

	// H2: relational penalty grows with normalization (pg-norm > pg-jsonb > mongo).
	const h2Results = agents.map(
		(a) =>
			a.lanes["postgres-norm"].medianTokensRead >
			a.lanes["postgres-jsonb"].medianTokensRead,
	);
	const h2Confirmed = h2Results.every(Boolean);
	const h2Refuted = h2Results.every((b) => !b);

	return {
		H1: {
			statement:
				"MongoDB requires less agent work (tokensRead) than any relational lane, within-agent",
			verdict: h1Confirmed
				? "confirmed"
				: h1Refuted
					? "refuted"
					: "inconclusive",
			perAgent: agents.map((a) => ({
				agentId: a.agentId,
				pgNormPct: a.vsMongo["postgres-norm"].tokensPct,
				pgJsonbPct: a.vsMongo["postgres-jsonb"].tokensPct,
			})),
		},
		H2: {
			statement:
				"Relational penalty grows with normalization depth (pg-norm > pg-jsonb > mongo)",
			verdict: h2Confirmed
				? "confirmed"
				: h2Refuted
					? "refuted"
					: "inconclusive",
			perAgent: agents.map((a) => ({
				agentId: a.agentId,
				pgNormTokens: a.lanes["postgres-norm"].medianTokensRead,
				pgJsonbTokens: a.lanes["postgres-jsonb"].medianTokensRead,
			})),
		},
	};
}

export function scoreComplex() {
	const agents = AGENTS.map((a) => scoreAgent(a));
	const hypotheses = markHypothesis(agents);

	const summary = {
		schemaVersion: "1.0.0",
		suiteId: "build-bench-enterprise",
		taskType: TASK_TYPE,
		generatedAt: new Date().toISOString(),
		executionMode: "live-db",
		model: { "claude-code": "sonnet", codex: "gpt-5.6-terra" },
		lanes: LANES,
		agents,
		hypotheses,
		caveat:
			"Within-agent comparison only. Each agent is measured against itself across the three database designs; one agent's absolute numbers are never compared to the other's, because the two CLIs count tokens incompatibly.",
	};
	writeJson(OUT, summary);
	return summary;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
	const s = scoreComplex();
	console.log(`Build-Bench enterprise summary written to ${OUT}`);
	for (const agent of s.agents) {
		console.log(
			`\n=== ${agent.agentId} (model: ${s.model[agent.agentId]}) ===`,
		);
		for (const lane of LANES) {
			const ls = agent.lanes[lane];
			console.log(
				`  ${lane.padEnd(16)} median tokensRead=${ls.medianTokensRead}  IQR=${ls.iqrTokensRead}  time=${ls.medianElapsedMs}ms  clean=${ls.cleanRepeats}/${ls.totalRepeats} (fail=${ls.failCount})  files=${ls.medianFilesChanged}`,
			);
		}
		console.log(
			`  vsMongo (tokensPct): pg-norm=${agent.vsMongo["postgres-norm"].tokensPct}%  pg-jsonb=${agent.vsMongo["postgres-jsonb"].tokensPct}%`,
		);
	}
	console.log(`\n=== Hypotheses ===`);
	console.log(
		`  H1: ${s.hypotheses.H1.verdict} — ${s.hypotheses.H1.statement}`,
	);
	console.log(
		`  H2: ${s.hypotheses.H2.verdict} — ${s.hypotheses.H2.statement}`,
	);
	console.log(`\n${s.caveat}`);
}
