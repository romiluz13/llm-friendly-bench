// Test: build-bench batch runner — alreadyClean + cell enumeration.
// Seam: alreadyClean(cell) detects existing clean manifests for resumability.
import assert from "node:assert";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { alreadyClean } from "./benchmark-batch-buildbench.mjs";

const RUN_ROOT = "benchmark/runs-buildbench";
const TMP_LANE = "mongo";
const TMP_AGENT = "codex";
const TMP_REPEAT = 99; // use a repeat number that won't collide with real runs

function manifestPath(cell) {
	return join(
		RUN_ROOT,
		cell.taskType,
		cell.lane,
		cell.agentId,
		`repeat-${cell.repeat}`,
		"run-manifest.json",
	);
}

function writeManifest(cell, overrides = {}) {
	const dir = join(
		RUN_ROOT,
		cell.taskType,
		cell.lane,
		cell.agentId,
		`repeat-${cell.repeat}`,
	);
	mkdirSync(dir, { recursive: true });
	const base = {
		status: "passed",
		metrics: {
			liveDbWritten: true,
			cheatSignals: [],
			changedFiles: ["src/accounts.mjs", "src/schema.mjs"],
		},
	};
	writeFileSync(manifestPath(cell), JSON.stringify({ ...base, ...overrides }));
}

const cell = {
	taskType: "greenfield-crud",
	lane: TMP_LANE,
	agentId: TMP_AGENT,
	repeat: TMP_REPEAT,
};

// 1) No manifest -> not clean
rmSync(
	join(
		RUN_ROOT,
		cell.taskType,
		cell.lane,
		cell.agentId,
		`repeat-${TMP_REPEAT}`,
	),
	{ recursive: true, force: true },
);
assert.strictEqual(alreadyClean(cell), false, "no manifest -> not clean");

// 2) Clean manifest -> clean
writeManifest(cell);
assert.strictEqual(alreadyClean(cell), true, "clean manifest -> clean");

// 3) Failed status -> not clean
writeManifest(cell, { status: "failed" });
assert.strictEqual(alreadyClean(cell), false, "failed status -> not clean");

// 4) liveDbWritten false -> not clean
writeManifest(cell, {
	metrics: {
		liveDbWritten: false,
		cheatSignals: [],
		changedFiles: ["src/accounts.mjs", "src/schema.mjs"],
	},
});
assert.strictEqual(
	alreadyClean(cell),
	false,
	"liveDbWritten false -> not clean",
);

// 5) cheat signals present -> not clean
writeManifest(cell, {
	metrics: {
		liveDbWritten: true,
		cheatSignals: ["test-stub-db"],
		changedFiles: ["src/accounts.mjs", "src/schema.mjs"],
	},
});
assert.strictEqual(alreadyClean(cell), false, "cheat signals -> not clean");

// 6) protected file modified -> not clean
writeManifest(cell, {
	metrics: {
		liveDbWritten: true,
		cheatSignals: [],
		changedFiles: ["src/db.mjs", "src/accounts.mjs", "src/schema.mjs"],
	},
});
assert.strictEqual(
	alreadyClean(cell),
	false,
	"protected file in changedFiles -> not clean",
);

// 7) only one expected file changed -> not clean (agent must edit both schema + model)
writeManifest(cell, {
	metrics: {
		liveDbWritten: true,
		cheatSignals: [],
		changedFiles: ["src/schema.mjs"],
	},
});
assert.strictEqual(
	alreadyClean(cell),
	false,
	"only one file changed -> not clean",
);

// cleanup
rmSync(
	join(
		RUN_ROOT,
		cell.taskType,
		cell.lane,
		cell.agentId,
		`repeat-${TMP_REPEAT}`,
	),
	{ recursive: true, force: true },
);

console.log("build-bench batch runner ok");
