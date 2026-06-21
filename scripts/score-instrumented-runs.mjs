#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeJson } from "./proof-fixtures.mjs";

const runId = process.env.RUN_ID || "order-exception-codex-v1";
const runRoot = join("instrumented-agent-runs", runId);
const mongo = readManifest("mongo");
const postgres = readManifest("postgres");

const summary = {
  schemaVersion: "1.0.0",
  runId,
  generatedAt: new Date().toISOString(),
  status: mongo.status === "passed" && postgres.status === "passed" ? "passed" : "failed",
  agent: "Codex",
  lanes: {
    mongo: laneMetrics(mongo),
    postgres: laneMetrics(postgres)
  },
  deltas: buildDeltas(mongo.metrics, postgres.metrics),
  costModel: buildCostModel(mongo.metrics, postgres.metrics)
};

writeJson(join(runRoot, "summary.json"), summary);

if (summary.status !== "passed") {
  console.error(`Instrumented run summary failed: ${runRoot}/summary.json`);
  process.exit(1);
}

console.log(`Instrumented run summary passed: ${runRoot}/summary.json`);

function readManifest(lane) {
  const path = join(runRoot, lane, "run-manifest.json");
  if (!existsSync(path)) throw new Error(`Missing run manifest: ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function laneMetrics(manifest) {
  return {
    status: manifest.status,
    cliVersion: manifest.agent.cliVersion,
    elapsedMs: manifest.metrics.elapsedMs,
    transcriptBytes: manifest.metrics.transcriptBytes,
    estimatedTranscriptTokens: manifest.metrics.estimatedTranscriptTokens,
    diffBytes: manifest.metrics.diffBytes,
    filesChanged: manifest.metrics.filesChanged,
    changedFiles: manifest.metrics.changedFiles || [],
    retrySignals: manifest.metrics.retrySignals,
    testStatus: manifest.metrics.testStatus,
    artifacts: manifest.artifacts
  };
}

function buildDeltas(mongoMetrics, postgresMetrics) {
  return {
    estimatedTranscriptTokenDelta: postgresMetrics.estimatedTranscriptTokens - mongoMetrics.estimatedTranscriptTokens,
    transcriptReductionPct: pct(postgresMetrics.estimatedTranscriptTokens - mongoMetrics.estimatedTranscriptTokens, postgresMetrics.estimatedTranscriptTokens),
    elapsedMsDelta: postgresMetrics.elapsedMs - mongoMetrics.elapsedMs,
    diffBytesDelta: postgresMetrics.diffBytes - mongoMetrics.diffBytes,
    filesChangedDelta: postgresMetrics.filesChanged - mongoMetrics.filesChanged,
    retrySignalDelta: postgresMetrics.retrySignals - mongoMetrics.retrySignals
  };
}

function buildCostModel(mongoMetrics, postgresMetrics) {
  const assumptions = {
    tokenEstimator: "ceil(captured Codex transcript bytes / 4)",
    blendedModelCostPerMillionContextTokensUsd: 10,
    engineeringReviewRateUsdPerHour: 150,
    reviewMinutesPerChangedFile: 3,
    reviewMinutesPerRetrySignal: 0.5,
    agentTasksPerMonth: 4000
  };
  const tokenDelta = Math.max(0, postgresMetrics.estimatedTranscriptTokens - mongoMetrics.estimatedTranscriptTokens);
  const fileDelta = Math.max(0, postgresMetrics.filesChanged - mongoMetrics.filesChanged);
  const retryDelta = Math.max(0, postgresMetrics.retrySignals - mongoMetrics.retrySignals);
  const reviewMinutesDelta = Math.round((fileDelta * assumptions.reviewMinutesPerChangedFile + retryDelta * assumptions.reviewMinutesPerRetrySignal) * 10) / 10;
  const modelDeltaUsd = (tokenDelta / 1_000_000) * assumptions.blendedModelCostPerMillionContextTokensUsd;
  const reviewDeltaUsd = (reviewMinutesDelta / 60) * assumptions.engineeringReviewRateUsdPerHour;
  const perTaskDeltaUsd = modelDeltaUsd + reviewDeltaUsd;

  return {
    assumptions,
    tokenDelta,
    reviewMinutesDelta,
    modelDeltaUsd,
    reviewDeltaUsd,
    perTaskDeltaUsd,
    monthlyDeltaUsd: perTaskDeltaUsd * assumptions.agentTasksPerMonth
  };
}

function pct(delta, base) {
  if (!base) return 0;
  return Math.round((delta / base) * 100);
}
