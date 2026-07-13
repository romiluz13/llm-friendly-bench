// Test: build-bench scoring — medians, within-agent deltas, hypothesis marking.
// Seam: scoreBuildBench() reads manifests from disk and produces a summary
// with per-lane-per-agent medians, within-agent deltas, and H1/H2 verdicts.
import assert from "node:assert";
import {
	scoreBuildBench,
	isCleanBuildBench,
} from "./benchmark-score-buildbench.mjs";

// 1) isCleanBuildBench: a manifest with passed + liveDbWritten + no cheats + correct files
assert.strictEqual(
	isCleanBuildBench({
		status: "passed",
		metrics: {
			liveDbWritten: true,
			cheatSignals: [],
			changedFiles: ["src/accounts.mjs", "src/schema.mjs"],
		},
	}),
	true,
	"clean manifest should be clean",
);

assert.strictEqual(
	isCleanBuildBench({
		status: "failed",
		metrics: {
			liveDbWritten: true,
			cheatSignals: [],
			changedFiles: ["src/accounts.mjs", "src/schema.mjs"],
		},
	}),
	false,
	"failed status should not be clean",
);

assert.strictEqual(
	isCleanBuildBench({
		status: "passed",
		metrics: {
			liveDbWritten: false,
			cheatSignals: [],
			changedFiles: ["src/accounts.mjs", "src/schema.mjs"],
		},
	}),
	false,
	"liveDbWritten false should not be clean",
);

assert.strictEqual(
	isCleanBuildBench({
		status: "passed",
		metrics: {
			liveDbWritten: true,
			cheatSignals: ["test-stub-db"],
			changedFiles: ["src/accounts.mjs", "src/schema.mjs"],
		},
	}),
	false,
	"cheat signals should not be clean",
);

// 2) scoreBuildBench: produces a summary with the right structure
const summary = scoreBuildBench();
assert(summary, "scoreBuildBench returns a summary");
assert.strictEqual(summary.suiteId, "build-bench", "suiteId is build-bench");
assert(Array.isArray(summary.agents), "summary has agents array");

// Each agent has per-lane stats with medians
for (const agent of summary.agents) {
	assert(agent.lanes, `${agent.agentId} has lanes`);
	for (const lane of ["mongo", "postgres-norm", "postgres-jsonb"]) {
		assert(agent.lanes[lane], `${agent.agentId} has lane ${lane}`);
		const s = agent.lanes[lane];
		assert(
			typeof s.cleanRepeats === "number",
			`${agent.agentId}/${lane} has cleanRepeats`,
		);
		assert(
			typeof s.medianTokensRead === "number",
			`${agent.agentId}/${lane} has medianTokensRead`,
		);
		assert(
			typeof s.iqrTokensRead === "number",
			`${agent.agentId}/${lane} has iqrTokensRead`,
		);
	}
	// within-agent deltas vs mongo
	assert(agent.vsMongo, `${agent.agentId} has vsMongo deltas`);
	for (const lane of ["postgres-norm", "postgres-jsonb"]) {
		assert(
			typeof agent.vsMongo[lane].tokensPct === "number",
			`${agent.agentId} has vsMongo ${lane} tokensPct`,
		);
	}
}

// 3) hypotheses are present and have a verdict
assert(summary.hypotheses, "summary has hypotheses");
assert(summary.hypotheses.H1, "H1 is present");
assert(
	["confirmed", "refuted", "inconclusive"].includes(
		summary.hypotheses.H1.verdict,
	),
	"H1 has a valid verdict",
);
assert(summary.hypotheses.H2, "H2 is present");
assert(
	["confirmed", "refuted", "inconclusive"].includes(
		summary.hypotheses.H2.verdict,
	),
	"H2 has a valid verdict",
);

// 4) caveat is present (within-agent only)
assert(/within-agent/i.test(summary.caveat), "summary has within-agent caveat");

console.log("build-bench scoring ok");
