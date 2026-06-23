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
  readRunManifestsV2,
  readSuite,
  readSuiteFile,
  resultPath,
  resultPathV2,
  seedEvidenceBundlePath,
  seedReplayPath,
  seedRunSummaryPath,
  source,
  suitePathV2,
  writeJson
} from "./benchmark-lib.mjs";

// 2026-06-23: seed replay validated under the pre-fix gameable acceptance tests; archived as raw artifact, not scored until re-run clean.
const SEED_VERIFIED_CLEAN = false;

export function computeDatabaseVerdict(runs) {
  const passed = runs.filter((r) => r.status === "passed" && !(r.metrics?.cheatSignals?.length));
  const agents = [...new Set(passed.map((r) => r.agentId))];
  const perAgent = agents.map((agentId) => {
    const lane = (id) => {
      const rows = passed.filter((r) => r.agentId === agentId && r.lane === id);
      const tok = (r) => { const t = r.metrics.tokens || {}; return (t.tokensRead != null) ? t.tokensRead : ((t.inputTokens || 0) + (t.cachedInputTokens || 0)) || t.totalTokens || r.metrics.estimatedTranscriptTokens || 0; };
      return {
        runs: rows.length,
        medianTokensRead: median(rows.map(tok)),
        medianCostUsd: median(rows.map((r) => r.metrics.tokens?.costUsd ?? 0)),
        medianElapsedMs: median(rows.map((r) => r.metrics.elapsedMs)),
        medianRetrySignals: median(rows.map((r) => r.metrics.retrySignals))
      };
    };
    const mongo = lane("mongo");
    const postgres = lane("postgres");
    const pct = (a, b) => (a > 0 ? Math.round(((b - a) / a) * 100) : 0);
    return {
      agentId, mongo, postgres,
      deltas: {
        tokensPct: pct(mongo.medianTokensRead, postgres.medianTokensRead),
        costPct: pct(mongo.medianCostUsd, postgres.medianCostUsd),
        timePct: pct(mongo.medianElapsedMs, postgres.medianElapsedMs),
        retries: postgres.medianRetrySignals - mongo.medianRetrySignals
      },
      mongoWins: mongo.medianTokensRead > 0 && postgres.medianTokensRead > mongo.medianTokensRead
    };
  });
  const agree = perAgent.length > 0 && perAgent.every((a) => a.mongoWins);
  const agentCount = perAgent.length;
  const metricUniversal = {
    "read more context": perAgent.every((a) => a.deltas.tokensPct > 0),
    "cost more": perAgent.every((a) => a.deltas.costPct > 0),
    "took longer": perAgent.every((a) => a.deltas.timePct > 0),
    "retried more": perAgent.every((a) => a.deltas.retries > 0)
  };
  const worse = Object.keys(metricUniversal).filter((k) => metricUniversal[k]);
  const mixed = Object.keys(metricUniversal).filter((k) => !metricUniversal[k]);
  const metricToReadable = { "read more context": "context", "cost more": "cost", "took longer": "time", "retried more": "retries" };
  const universalMetrics = worse.map((k) => metricToReadable[k]);
  const mixedMetrics = mixed.map((k) => metricToReadable[k]);
  let statement;
  if (agree) {
    const subjectPrefix = agentCount === 2 ? "Both agents" : agentCount === 1 ? "1 agent" : `All ${agentCount} agents`;
    const worseList = worse.length === 0
      ? "used more tokens"
      : worse.length === 1
        ? worse[0]
        : worse.slice(0, -1).join(", ") + ", and " + worse[worse.length - 1];
    statement = `${subjectPrefix} independently ${worseList} on Postgres for the same tasks.`;
    if (mixed.length > 0) {
      const mixedNames = mixed.map((k) => metricToReadable[k]);
      const mixedLabel = mixedNames.length === 1 ? mixedNames[0] : mixedNames.join(" and ");
      statement += ` ${mixedLabel.charAt(0).toUpperCase() + mixedLabel.slice(1)} ${mixedNames.length === 1 ? "was" : "were"} mixed across agents — see per-agent detail.`;
    }
  } else {
    statement = "Agents did not unanimously favor MongoDB on tokens-read; see per-agent detail.";
  }
  return {
    perAgent,
    agreement: {
      agentsAgreeMongoFewerTokens: agree,
      agentCount,
      statement,
      universalMetrics,
      mixedMetrics
    },
    caveat: "Within-agent comparison only. Each agent is measured against itself; one agent's raw numbers are not comparable to the other's, because the two tools count their work differently."
  };
}

export function computeShapeVerdict(runs) {
  const SHAPES = ["shallow", "moderate", "deep"];
  const passed = runs.filter((r) => r.status === "passed" && Array.isArray(r.metrics?.cheatSignals) && r.metrics.cheatSignals.length === 0);
  const tok = (r) => { const t = r.metrics.tokens || {}; return (t.tokensRead != null) ? t.tokensRead : ((t.inputTokens||0)+(t.cachedInputTokens||0)) || 0; };
  const pct = (a, b) => (a > 0 ? Math.round(((b - a) / a) * 100) : 0);
  const perShape = SHAPES.map((shape) => {
    const agents = [...new Set(passed.filter((r) => r.shape === shape).map((r) => r.agentId))];
    const perAgent = agents.map((agentId) => {
      const lane = (id) => passed.filter((r) => r.shape === shape && r.agentId === agentId && r.lane === id);
      const m = lane("mongo"), p = lane("postgres");
      const mTok = median(m.map(tok)), pTok = median(p.map(tok));
      return {
        agentId,
        deltas: {
          tokensReadPct: pct(mTok, pTok),
          costPct: pct(median(m.map((r)=>r.metrics.tokens?.costUsd??0)), median(p.map((r)=>r.metrics.tokens?.costUsd??0))),
          timePct: pct(median(m.map((r)=>r.metrics.elapsedMs)), median(p.map((r)=>r.metrics.elapsedMs))),
          retries: median(p.map((r)=>r.metrics.retrySignals)) - median(m.map((r)=>r.metrics.retrySignals))
        },
        mongoWins: mTok > 0 && pTok > mTok
      };
    });
    return { shape, perAgent };
  });
  const avgPct = (shape) => {
    const rows = perShape.find((s) => s.shape === shape)?.perAgent || [];
    return rows.length ? Math.round(rows.reduce((a, r) => a + r.deltas.tokensReadPct, 0) / rows.length) : 0;
  };
  const byShape = { shallow: avgPct("shallow"), moderate: avgPct("moderate"), deep: avgPct("deep") };
  return {
    perShape,
    depthTrend: { tokensReadPctByShape: byShape, growsWithDepth: byShape.deep > byShape.moderate && byShape.moderate >= byShape.shallow },
    caveat: "Within-agent comparison only. Same business outcome across all shapes; only Postgres relational depth differs."
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const suiteArg = process.argv.includes("--suite") ? process.argv[process.argv.indexOf("--suite") + 1] : "ast-bench-v1";
  if (suiteArg === "ast-bench-v2") {
    scoreV2();
  } else {
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
    databaseVerdict: computeDatabaseVerdict(capturedRuns),
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
  }
}

function scoreV2() {
  const suiteV2 = readSuiteFile(suitePathV2);
  const allRuns = readRunManifestsV2(suiteV2);
  const cleanRuns = allRuns.filter((r) => Array.isArray(r.metrics?.cheatSignals) && r.metrics.cheatSignals.length === 0);
  const passedRuns = cleanRuns.filter((r) => r.status === "passed");
  const passedLaneRuns = passedRuns.length;
  const required = suiteV2.requiredLaneRuns;
  const status = passedLaneRuns >= 54 ? "pilot" : passedLaneRuns >= 2 ? "case-study" : "case-study";
  const perShapeCounts = Object.fromEntries(suiteV2.shapes.map((shape) => [shape, {
    captured: cleanRuns.filter((r) => r.shape === shape).length,
    passed: passedRuns.filter((r) => r.shape === shape).length
  }]));
  const summary = {
    schemaVersion: "1.0.0",
    suiteId: "ast-bench-v2",
    generatedAt: new Date().toISOString(),
    status,
    claimLevel: status,
    requiredLaneRuns: required,
    capturedLaneRuns: cleanRuns.length,
    passedLaneRuns,
    missingLaneRuns: Math.max(0, required - passedLaneRuns),
    shapes: suiteV2.shapes,
    agents: suiteV2.agents.map((a) => ({ id: a.id, label: a.label, adapter: a.adapter,
      passedLaneRuns: passedRuns.filter((r) => r.agentId === a.id).length })),
    lanes: suiteV2.lanes,
    perShapeCounts,
    databaseVerdict: computeDatabaseVerdict(cleanRuns),
    shapeVerdict: computeShapeVerdict(cleanRuns),
    caveats: [
      "Within-agent comparison only. Cross-agent absolute token counts are not comparable.",
      "Same business outcome across all 3 schema shapes; only Postgres relational depth differs.",
      "A MongoDB loss on any metric or shape is shown, not hidden.",
      "Idiomatic Postgres normalization; independent fairness review is the documented path to official status."
    ]
  };
  writeJson(resultPathV2, summary);
  console.log(`AST-Bench v2 score emitted: ${resultPathV2} (${status}, ${passedLaneRuns}/${required} passed lane runs)`);
}

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
    capturedLaneRuns: runs.length + (isSeed && SEED_VERIFIED_CLEAN ? 2 : 0),
    status: isSeed && SEED_VERIFIED_CLEAN ? "seed-case" : runs.length ? "captured" : "defined"
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
