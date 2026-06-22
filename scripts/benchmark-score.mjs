#!/usr/bin/env node

import { existsSync } from "node:fs";
import {
  expectedLaneRuns,
  formatMoneyShort,
  hashExisting,
  iqr,
  listTasks,
  median,
  publicBundlePath,
  readJson,
  readRunManifests,
  readSuite,
  resultPath,
  seedEvidenceBundlePath,
  seedReplayPath,
  seedRunSummaryPath,
  source,
  writeJson
} from "./benchmark-lib.mjs";

// 2026-06-23: seed replay validated under the pre-fix gameable acceptance tests; archived as raw artifact, not scored until re-run clean.
const SEED_VERIFIED_CLEAN = false;

const suite = readSuite();
const tasks = listTasks(suite);
const allCapturedRuns = readRunManifests(suite);
// Exclude runs that lack a cheatSignals field (pre-fix harness; e.g. the globalThis.db renewal-risk run)
// and runs whose cheatSignals are non-empty — both represent tainted evidence.
const capturedRuns = allCapturedRuns.filter(
  (run) => Array.isArray(run.metrics?.cheatSignals) && run.metrics.cheatSignals.length === 0
);
const seed = existsSync(seedRunSummaryPath) ? readJson(seedRunSummaryPath) : null;
const seedReplay = existsSync(seedReplayPath) ? readJson(seedReplayPath) : null;
const seedBundle = existsSync(seedEvidenceBundlePath) ? readJson(seedEvidenceBundlePath) : null;
const seedLaneRuns = SEED_VERIFIED_CLEAN && seed?.status === "passed" ? 2 : 0;
const passedRuns = capturedRuns.filter((run) => run.status === "passed");
const capturedLaneRuns = seedLaneRuns + capturedRuns.length;
const passedLaneRuns = seedLaneRuns + passedRuns.length;
const status = promotionStatus({ suite, capturedLaneRuns, passedLaneRuns, capturedRuns });
const required = expectedLaneRuns(suite);
const seedDeltas = seed?.deltas || {};
const seedCost = seed?.costModel || {};

const summary = {
  schemaVersion: "1.0.0",
  suiteId: suite.suiteId,
  generatedAt: new Date().toISOString(),
  status,
  claimLevel: status,
  requiredLaneRuns: required,
  capturedLaneRuns,
  passedLaneRuns,
  missingLaneRuns: Math.max(0, required - passedLaneRuns),
  taskCount: tasks.length,
  taskCells: tasks.length * suite.agents.length * suite.lanes.length * suite.repeatsPerCell,
  agents: suite.agents.map((agent) => ({
    id: agent.id,
    label: agent.label,
    adapter: agent.adapter,
    capturedLaneRuns: capturedRuns.filter((run) => run.agentId === agent.id).length + (agent.id === "codex" ? seedLaneRuns : 0),
    claimStatus: agent.id === "codex" && seedLaneRuns ? "seed-captured" : "not-yet-verified"
  })),
  lanes: suite.lanes,
  tasks: tasks.map((task) => taskStatus(task, capturedRuns, seedReplay)),
  aggregate: aggregateRuns(capturedRuns, seed),
  currentSeed: buildSeedSummary({ seed, seedReplay, seedBundle }),
  costModel: buildCostModel(seedCost),
  evidenceSources: hashExisting([
    seedRunSummaryPath,
    seedReplayPath,
    seedEvidenceBundlePath,
    "data/generated/proof/verified-evidence-manifest.json"
  ]),
  publicBundlePath,
  caveats: [
    "Current public data is seed case-study evidence until the 450 required V1 lane runs are captured.",
    "AST-Bench V1 requires Codex, Claude Code, and Cursor before multi-agent claims are allowed.",
    "Cost projection separates captured run deltas from user-editable assumptions.",
    "Mixed metrics remain visible; a MongoDB loss on any metric is not hidden."
  ]
};

writeJson(resultPath, summary);
console.log(`AST-Bench score emitted: ${resultPath} (${status}, ${passedLaneRuns}/${required} passed lane runs)`);

function promotionStatus({ suite, capturedLaneRuns, passedLaneRuns, capturedRuns }) {
  if (passedLaneRuns >= suite.requiredLaneRuns && hasEveryRequiredCell(suite, capturedRuns)) return "public-v1";
  if (passedLaneRuns >= 54) return "pilot";
  if (capturedLaneRuns >= 2) return "case-study";
  return "case-study";
}

function hasEveryRequiredCell(suite, manifests) {
  const keys = new Set(manifests.filter((run) => run.status === "passed").map((run) => `${run.taskId}/${run.agentId}/${run.repeat}/${run.lane}`));
  for (const task of listTasks(suite)) {
    for (const agent of suite.agents) {
      for (let repeat = 1; repeat <= suite.repeatsPerCell; repeat += 1) {
        for (const lane of suite.lanes) {
          if (!keys.has(`${task.id}/${agent.id}/${repeat}/${lane.id}`)) return false;
        }
      }
    }
  }
  return true;
}

function taskStatus(task, manifests, seedReplay) {
  const runs = manifests.filter((run) => run.taskId === task.id);
  const isSeed = seedReplay?.scenario && task.seedReplayId === seedReplay.artifactId;
  return {
    id: task.id,
    title: task.title,
    domainId: task.domainId,
    domainLabel: task.domainLabel,
    expectedOutcome: task.expectedOutcome,
    seedCase: Boolean(isSeed),
    capturedLaneRuns: runs.length + (isSeed ? 2 : 0),
    status: isSeed ? "seed-case" : runs.length ? "captured" : "defined"
  };
}

function aggregateRuns(manifests, seed) {
  const rows = [];
  if (SEED_VERIFIED_CLEAN && seed?.status === "passed") {
    rows.push(seedMetricRow("mongo", seed.lanes.mongo));
    rows.push(seedMetricRow("postgres", seed.lanes.postgres));
  }
  for (const run of manifests) {
    rows.push({
      lane: run.lane,
      agentId: run.agentId,
      elapsedMs: run.metrics.elapsedMs,
      estimatedTranscriptTokens: run.metrics.estimatedTranscriptTokens,
      retrySignals: run.metrics.retrySignals,
      failedCommandCount: run.metrics.failedCommandCount,
      diffBytes: run.metrics.diffBytes,
      filesChanged: run.metrics.filesChanged
    });
  }
  return {
    rows: rows.length,
    byLane: Object.fromEntries(["mongo", "postgres"].map((lane) => {
      const laneRows = rows.filter((row) => row.lane === lane);
      return [lane, {
        rowCount: laneRows.length,
        medianElapsedMs: median(laneRows.map((row) => row.elapsedMs)),
        medianEstimatedTranscriptTokens: median(laneRows.map((row) => row.estimatedTranscriptTokens)),
        tokenIqr: iqr(laneRows.map((row) => row.estimatedTranscriptTokens)),
        medianRetrySignals: median(laneRows.map((row) => row.retrySignals)),
        medianDiffBytes: median(laneRows.map((row) => row.diffBytes)),
        medianFilesChanged: median(laneRows.map((row) => row.filesChanged))
      }];
    }))
  };
}

function seedMetricRow(lane, metrics) {
  return {
    lane,
    agentId: "codex",
    elapsedMs: metrics.elapsedMs,
    estimatedTranscriptTokens: metrics.estimatedTranscriptTokens,
    retrySignals: metrics.retrySignals,
    failedCommandCount: 0,
    diffBytes: metrics.diffBytes,
    filesChanged: metrics.filesChanged
  };
}

function buildSeedSummary({ seed, seedReplay, seedBundle }) {
  if (!seed || !seedReplay || !seedBundle) return { status: "missing" };
  return {
    status: "captured",
    artifactId: seedReplay.artifactId,
    scenario: `${seedReplay.scenario.name} / ${seedReplay.scenario.variant}`,
    agent: seedReplay.agent,
    headline: seedBundle.headline,
    measuredDeltas: {
      estimatedTranscriptTokens: seed.deltas.estimatedTranscriptTokenDelta,
      elapsedSeconds: Math.round(seed.deltas.elapsedMsDelta / 1000),
      retrySignals: seed.deltas.retrySignalDelta,
      diffBytes: seed.deltas.diffBytesDelta
    },
    sources: [
      source(seedRunSummaryPath),
      source(seedReplayPath),
      source(seedEvidenceBundlePath),
      source("data/generated/proof/verified-evidence-manifest.json")
    ]
  };
}

function buildCostModel(seedCost) {
  const assumptions = seedCost.assumptions || {
    blendedModelCostPerMillionContextTokensUsd: 10,
    engineeringReviewRateUsdPerHour: 150,
    agentTasksPerMonth: 4000
  };
  return {
    measuredSeedOnly: true,
    assumptions,
    perTaskDeltaUsd: seedCost.perTaskDeltaUsd || 0,
    monthlyDeltaUsd: seedCost.monthlyDeltaUsd || 0,
    publicLabel: `${formatMoneyShort(seedCost.monthlyDeltaUsd || 0)} seed-case monthly projection under visible assumptions`,
    caveat: "Only the seed replay deltas are measured today; V1 aggregate cost waits for the full run set."
  };
}
