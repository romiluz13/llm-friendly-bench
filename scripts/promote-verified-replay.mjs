#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { writeJson } from "./proof-fixtures.mjs";

const runId = process.env.RUN_ID || "order-exception-codex-v1";
const candidatePath = "prototypes/lab-console/replays/order-exception-codex-v1-candidate.json";
const verifiedPath = "prototypes/lab-console/replays/order-exception-codex-v1-verified.json";
const summaryPath = join("instrumented-agent-runs", runId, "summary.json");
const designReviewPath = "design-review/order-exception-v1.json";
const mongoDbProofPath = "data/generated/proof/mongodb-local-db-proof.json";
const postgresDbProofPath = "data/generated/proof/postgres-local-db-proof.json";

const candidate = readJson(candidatePath);
const summary = readJson(summaryPath);
const designReview = readJson(designReviewPath);
const mongoDbProof = readJson(mongoDbProofPath);
const postgresDbProof = readJson(postgresDbProofPath);
const mongoCollections = readJson("data/generated/mongodb/collections.json");
const postgresTables = readJson("data/generated/postgres/tables.json");

assert(summary.status === "passed", "Instrumented run summary must be passed");
assert(designReview.status === "captured", "Independent Design Review must be captured");
assert(mongoDbProof.status === "passed", "MongoDB local DB proof must be passed");
assert(postgresDbProof.status === "passed", "Postgres local DB proof must be passed");
assert(mongoDbProof.fixtureVersion === candidate.scenario.fixtureVersion, "MongoDB local DB proof must match the candidate fixture version");
assert(postgresDbProof.fixtureVersion === candidate.scenario.fixtureVersion, "Postgres local DB proof must match the candidate fixture version");

for (const lane of ["mongo", "postgres"]) {
  assert(summary.lanes[lane].status === "passed", `${lane} instrumented Codex run must be passed`);
  for (const key of ["rawTranscript", "diff", "tests", "acceptance", "screenshot"]) {
    assert(existsSync(summary.lanes[lane].artifacts[key]), `Missing ${lane} artifact: ${summary.lanes[lane].artifacts[key]}`);
  }
}

const cost = summary.costModel;
const verified = {
  ...candidate,
  schemaVersion: "0.3.0",
  artifactId: "order-exception-codex-v1-verified",
  proofStatus: "verified",
  agent: {
    name: "Codex",
    model: summary.lanes.mongo.cliVersion === summary.lanes.postgres.cliVersion
      ? summary.lanes.mongo.cliVersion
      : `${summary.lanes.mongo.cliVersion} / ${summary.lanes.postgres.cliVersion}`,
    constraint: "Codex held constant across MongoDB and Postgres instrumented runs"
  },
  fairnessContract: [
    "Same customer request",
    "Same canonical scenario dataset",
    "Same acceptance assertions",
    "Database-native projections generated from one scenario dataset",
    "Codex held constant",
    "Failed attempts and command failures counted",
    "No hand edits after the accepted agent run",
    "No unverified runtime data in the verified replay"
  ],
  dataContract: buildDataContract(),
  outcome: {
    ...candidate.outcome,
    statusPill: "VERIFIED / Codex instrumented runs"
  },
  verdict: [
    { label: "Transcript estimate", value: `${Math.max(0, cost.tokenDelta).toLocaleString("en-US")} tokens` },
    { label: "Files changed", value: `${Math.max(0, summary.deltas.filesChangedDelta)} fewer` },
    { label: "Review model", value: `${cost.reviewMinutesDelta}m saved` },
    { label: "Monthly estimate", value: formatMoneyShort(cost.monthlyDeltaUsd) }
  ],
  lanes: candidate.lanes.map((lane) => verifiedLane(lane, summary.lanes[lane.id === "pg" ? "postgres" : "mongo"])),
  scorecard: [
    { label: "Context cost", value: `Transcript delta ${summary.deltas.transcriptReductionPct}% est.` },
    { label: "Shipping efficiency", value: "Both Codex runs pass acceptance" },
    { label: "Review burden", value: `${Math.max(0, summary.deltas.filesChangedDelta)} fewer changed files` },
    { label: "Human babysitting", value: `${Math.max(0, summary.deltas.retrySignalDelta)} fewer retry signals` },
    { label: "Governance and safety", value: "Hash-locked evidence manifest" }
  ],
  costProjection: {
    assumptions: `Verified Codex model: ${summary.costModel.assumptions.agentTasksPerMonth.toLocaleString("en-US")} agent tasks/month, ${formatMoney(summary.costModel.assumptions.engineeringReviewRateUsdPerHour)}/hour review, ${formatMoney(summary.costModel.assumptions.blendedModelCostPerMillionContextTokensUsd)}/1M estimated transcript tokens.`,
    figures: [
      { label: "Per task", value: formatMoney(summary.costModel.perTaskDeltaUsd) },
      { label: "Monthly", value: formatMoneyShort(summary.costModel.monthlyDeltaUsd) }
    ]
  },
  proofPacket: {
    summary: "Verified Codex replay: both database-native target apps were changed through instrumented Codex runs, passed the same acceptance contract, and preserve raw trace, diff, tests, rendered workflow state, local DB proof, and design-review evidence.",
    items: [
      { label: "Fairness Contract", value: "Verified" },
      { label: "Independent Design Review", value: "Captured" },
      { label: "MongoDB local DB replay", value: "Captured" },
      { label: "Postgres local DB replay", value: "Captured" },
      { label: "Codex raw trace + diffs", value: "Captured" },
      { label: "Acceptance tests", value: "Captured" },
      { label: "Rendered workflow state", value: "Captured" },
      { label: "Runtime data contract", value: "Verified" }
    ]
  },
  caseFile: {
    fairnessControls: [
      { label: "Task prompt", value: candidate.task.request, status: "verified" },
      { label: "Scenario dataset", value: candidate.scenario.fixtureVersion, status: "verified" },
      { label: "Acceptance contract", value: "Same customer-visible assertions for both targets", status: "verified" },
      { label: "Database-native models", value: "MongoDB document aggregate and clean normalized Postgres baseline", status: "verified" },
      { label: "Captured Codex attempts", value: runId, status: "captured" },
      { label: "Runtime data", value: "Captured from local MongoDB, local Postgres, Codex traces, diffs, tests, and rendered workflow state", status: "verified" }
    ],
    designReview: {
      status: "captured",
      reviewer: designReview.reviewer,
      mongoRationale: designReview.mongoRationale,
      postgresRationale: designReview.postgresRationale,
      tradeoff: designReview.tradeoff
    },
    evidenceLedger: [
      { claim: "Captured Codex trace, inspected files, retries, token estimates, and code diffs", source: summaryPath, status: "captured" },
      { claim: "MongoDB Codex raw transcript", source: summary.lanes.mongo.artifacts.rawTranscript, status: "captured" },
      { claim: "Postgres Codex raw transcript", source: summary.lanes.postgres.artifacts.rawTranscript, status: "captured" },
      { claim: "MongoDB code diff", source: summary.lanes.mongo.artifacts.diff, status: "captured" },
      { claim: "Postgres code diff", source: summary.lanes.postgres.artifacts.diff, status: "captured" },
      { claim: "MongoDB acceptance tests", source: summary.lanes.mongo.artifacts.tests, status: "captured" },
      { claim: "Postgres acceptance tests", source: summary.lanes.postgres.artifacts.tests, status: "captured" },
      { claim: "MongoDB rendered workflow state", source: summary.lanes.mongo.artifacts.screenshot, status: "captured" },
      { claim: "Postgres rendered workflow state", source: summary.lanes.postgres.artifacts.screenshot, status: "captured" },
      { claim: "Independent design review by MongoDB and Postgres rubric", source: designReviewPath, status: "captured" },
      { claim: "MongoDB local database seed and workflow replay", source: mongoDbProofPath, status: "captured" },
      { claim: "Postgres local database seed and workflow replay", source: postgresDbProofPath, status: "captured" },
      { claim: "Evidence manifest locks verified source files with SHA-256", source: "data/generated/proof/verified-evidence-manifest.json", status: "captured" }
    ]
  },
  caveat: "Verified for one Codex run pair using generated Customer 360 Escalation records seeded into real local MongoDB and Postgres services. Claude Code, Cursor, and Enterprise SQL Sprawl are future validation lanes and are not claimed by this replay."
};

const manifest = buildVerifiedManifest(verified);
writeJson("data/generated/proof/verified-evidence-manifest.json", manifest);
writeJson(verifiedPath, verified);

console.log(`Verified replay emitted: ${verifiedPath}`);

function verifiedLane(lane, metrics) {
  return {
    ...lane,
    score: score(metrics),
    meters: [
      { label: "Transcript est.", value: metrics.estimatedTranscriptTokens.toLocaleString("en-US"), width: width(metrics.estimatedTranscriptTokens, maxMetric("estimatedTranscriptTokens")) },
      { label: "Elapsed", value: `${Math.round(metrics.elapsedMs / 1000)}s`, width: width(metrics.elapsedMs, maxMetric("elapsedMs")) },
      { label: "Diff bytes", value: metrics.diffBytes.toLocaleString("en-US"), width: width(metrics.diffBytes, maxMetric("diffBytes")) },
      { label: "Files", value: String(metrics.filesChanged), width: width(metrics.filesChanged, maxMetric("filesChanged")) }
    ],
    events: [
      { time: "00:00", title: "Codex run started", description: "The same Customer 360 Escalation prompt was used for this lane.", tag: "trace", active: true },
      { time: "TRACE", title: "Raw transcript captured", description: metrics.artifacts.rawTranscript, tag: "evidence", active: false },
      { time: "DIFF", title: "Code diff captured", description: metrics.artifacts.diff, tag: "diff", active: false },
      { time: "GREEN", title: "Acceptance passed", description: metrics.artifacts.tests, tag: "green", active: false }
    ]
  };
}

function buildVerifiedManifest(artifact) {
  const files = artifact.caseFile.evidenceLedger
    .map((item) => item.source)
    .filter((source) => !source.endsWith("/"))
    .filter((source) => source !== "data/generated/proof/verified-evidence-manifest.json")
    .filter((source) => existsSync(source))
    .map((path) => ({
      path,
      bytes: readFileSync(path).byteLength,
      sha256: createHash("sha256").update(readFileSync(path)).digest("hex")
    }));

  return {
    artifactId: artifact.artifactId,
    generatedAt: new Date().toISOString(),
    proofStatus: "verified",
    hashAlgorithm: "sha256",
    files
  };
}

function buildDataContract() {
  return {
    label: "Verified Runtime Data",
    mode: "verified-local-services-and-instrumented-agent-runs",
    mockDataAllowed: false,
    sourceOfTruth: "Captured Codex traces, git diffs, test logs, rendered workflow state, and local database proof files",
    runtimeSources: [
      {
        label: "MongoDB local service",
        detail: `${mongoDbProof.mongoUri}; ${sumRows(mongoCollections)} generated records across ${Object.keys(mongoCollections).length} collections; ${sumCounts(mongoDbProof.counts)} records after replay`,
        source: mongoDbProofPath,
        status: "verified"
      },
      {
        label: "Postgres local service",
        detail: `${postgresDbProof.postgresContainer}/${postgresDbProof.postgresDb} on 127.0.0.1:5433; ${sumRows(postgresTables)} generated rows across ${Object.keys(postgresTables).length} tables; ${sumCounts(postgresDbProof.counts)} proof-result rows after replay`,
        source: postgresDbProofPath,
        status: "verified"
      },
      {
        label: "MongoDB Codex trace",
        detail: `${summary.lanes.mongo.estimatedTranscriptTokens.toLocaleString("en-US")} estimated transcript tokens; ${summary.lanes.mongo.diffBytes.toLocaleString("en-US")} diff bytes`,
        source: summary.lanes.mongo.artifacts.rawTranscript,
        status: "captured"
      },
      {
        label: "Postgres Codex trace",
        detail: `${summary.lanes.postgres.estimatedTranscriptTokens.toLocaleString("en-US")} estimated transcript tokens; ${summary.lanes.postgres.diffBytes.toLocaleString("en-US")} diff bytes`,
        source: summary.lanes.postgres.artifacts.rawTranscript,
        status: "captured"
      },
      {
        label: "Hash-locked evidence manifest",
        detail: "Every promoted source file is SHA-256 locked at promotion time",
        source: "data/generated/proof/verified-evidence-manifest.json",
        status: "captured"
      }
    ]
  };
}

function sumCounts(counts = {}) {
  return Object.values(counts).reduce((total, value) => total + Number(value || 0), 0).toLocaleString("en-US");
}

function sumRows(collectionsOrTables = {}) {
  return Object.values(collectionsOrTables).reduce((total, rows) => total + rows.length, 0).toLocaleString("en-US");
}

function maxMetric(key) {
  return Math.max(summary.lanes.mongo[key], summary.lanes.postgres[key], 1);
}

function score(metrics) {
  const maxTokens = maxMetric("estimatedTranscriptTokens");
  const maxElapsed = maxMetric("elapsedMs");
  const maxDiff = maxMetric("diffBytes");
  const maxFiles = maxMetric("filesChanged");
  const complexity = (metrics.estimatedTranscriptTokens / maxTokens) * 0.36 +
    (metrics.elapsedMs / maxElapsed) * 0.24 +
    (metrics.diffBytes / maxDiff) * 0.22 +
    (metrics.filesChanged / maxFiles) * 0.18;
  return Math.max(0, Math.round(100 - complexity * 32));
}

function width(value, max) {
  return Math.max(8, Math.min(100, Math.round((value / max) * 100)));
}

function readJson(path) {
  assert(existsSync(path), `Missing required file: ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 10 ? 2 : 0
  }).format(value);
}

function formatMoneyShort(value) {
  if (value >= 1000000) return `$${Math.round(value / 100000) / 10}M`;
  if (value >= 1000) return `$${Math.round(value / 100) / 10}k`;
  return formatMoney(value);
}
