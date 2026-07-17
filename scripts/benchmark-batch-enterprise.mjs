#!/usr/bin/env node
// Build-Bench brownfield batch — schema-evolution-enterprise × 3 lanes × 2 agents × 5 repeats = 30 cells.
// Resumable: skips cells whose manifest already shows a clean pass.
//
// Usage: node scripts/benchmark-batch-brownfield.mjs [--lanes a,b] [--agents x,y] [--repeats N] [--pace-ms 15000] [--force]

import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runCellEnterprise } from "./benchmark-run-enterprise.mjs";

const ALL_LANES = ["mongo", "postgres-norm", "postgres-jsonb"];
const ALL_AGENTS = ["claude-code", "codex"];
const TASK_TYPE = "schema-evolution-enterprise";
const RUN_ROOT = "benchmark/runs-enterprise";
const PROGRESS = join(RUN_ROOT, "batch-progress.log");

function validateCsv(name, allowed) {
	const v = flag(name);
	if (!v) return allowed;
	const vals = v
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const invalid = vals.filter((x) => !allowed.includes(x));
	if (invalid.length) {
		console.error(
			`Invalid value(s) for ${name}: ${invalid.join(", ")}. Allowed: ${allowed.join(", ")}`,
		);
		process.exit(1);
	}
	return vals;
}

export function alreadyClean(cell) {
	const p = join(
		RUN_ROOT,
		cell.taskType,
		cell.lane,
		cell.agentId,
		`repeat-${cell.repeat}`,
		"run-manifest.json",
	);
	if (!existsSync(p)) return false;
	try {
		const m = JSON.parse(readFileSync(p, "utf8"));
		return (
			m.status === "passed" &&
			m.metrics?.liveDbWritten === true &&
			(m.metrics?.cheatSignals?.length || 0) === 0
		);
	} catch {
		return false;
	}
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
	const lanes = validateCsv("--lanes", ALL_LANES);
	const agents = validateCsv("--agents", ALL_AGENTS);
	const repeats = Number(flag("--repeats") || 5);
	const paceMs = Number(flag("--pace-ms") || 15000);
	const force = process.argv.includes("--force");

	mkdirSync(RUN_ROOT, { recursive: true });

	const cells = [];
	for (let repeat = 1; repeat <= repeats; repeat += 1)
		for (const lane of lanes)
			for (const agentId of agents)
				cells.push({ taskType: TASK_TYPE, lane, agentId, repeat });

	const started = nowStamp();
	log(
		`BATCH START ${started} — ${cells.length} cells (${lanes.length} lanes × ${agents.length} agents × ${repeats} repeats), pace=${paceMs}ms`,
	);

	let done = 0,
		passed = 0,
		failed = 0,
		skipped = 0;
	for (const cell of cells) {
		done += 1;
		const tag = `${cell.taskType}/${cell.lane}/${cell.agentId}/r${cell.repeat}`;
		if (!force && alreadyClean(cell)) {
			skipped += 1;
			passed += 1;
			log(`[${done}/${cells.length}] SKIP (already clean) ${tag}`);
			continue;
		}
		try {
			const res = runCellEnterprise({ ...cell, keepNs: false });
			if (res.status === "passed") {
				passed += 1;
				log(
					`[${done}/${cells.length}] PASS ${tag} tok=${res.tokensRead} model=${res.model}`,
				);
			} else {
				failed += 1;
				log(`[${done}/${cells.length}] FAIL ${tag} (status=${res.status})`);
			}
		} catch (e) {
			failed += 1;
			log(
				`[${done}/${cells.length}] ERROR ${tag}: ${String(e.message).slice(0, 200)}`,
			);
		}
		if (done < cells.length) sleepSync(paceMs);
	}

	log(
		`BATCH DONE — passed=${passed} failed=${failed} skipped=${skipped} of ${cells.length}`,
	);
}

function flag(name) {
	const i = process.argv.indexOf(name);
	return i >= 0 ? process.argv[i + 1] : "";
}
function log(line) {
	const s = `${nowStamp()} ${line}`;
	console.log(s);
	try {
		appendFileSync(PROGRESS, s + "\n");
	} catch {
		/* ignore */
	}
}
function nowStamp() {
	return new Date().toISOString().replace("T", " ").slice(0, 19);
}
function sleepSync(ms) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		Atomics.wait(
			new Int32Array(new SharedArrayBuffer(4)),
			0,
			0,
			Math.min(ms, end - Date.now()),
		);
	}
}
