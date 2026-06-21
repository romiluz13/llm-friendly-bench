#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import { writeJson } from "./proof-fixtures.mjs";

const runId = process.env.RUN_ID || "order-exception-codex-v1";
const outDir = join("prototypes/lab-console/evidence", runId);
const bundlePath = join(outDir, "evidence-bundle.json");
const verifiedPath = "prototypes/lab-console/replays/order-exception-codex-v1-verified.json";
const summaryPath = join("instrumented-agent-runs", runId, "summary.json");
const mongoProofPath = "data/generated/proof/mongodb-local-db-proof.json";
const postgresProofPath = "data/generated/proof/postgres-local-db-proof.json";
const designReviewPath = "design-review/order-exception-v1.json";
const manifestPath = "data/generated/proof/verified-evidence-manifest.json";

const artifact = readJson(verifiedPath);
const summary = readJson(summaryPath);
const mongoProof = readJson(mongoProofPath);
const postgresProof = readJson(postgresProofPath);
const designReview = readJson(designReviewPath);
const manifest = readJson(manifestPath);
const mongoCollections = readJson("data/generated/mongodb/collections.json");
const postgresTables = readJson("data/generated/postgres/tables.json");

mkdirSync(outDir, { recursive: true });

const portalStateRefs = {
  mongo: copyEvidenceAsset(summary.lanes.mongo.artifacts.screenshot, "mongo-workflow-state.svg"),
  postgres: copyEvidenceAsset(summary.lanes.postgres.artifacts.screenshot, "postgres-workflow-state.svg")
};
const measured = measuredNarrative();

const bundle = {
  schemaVersion: "1.0.0",
  artifactId: artifact.artifactId,
  generatedAt: new Date().toISOString(),
  status: "verified",
  headline: `This is about building software with AI agents, not building an AI app. Same feature. Same Codex. Same acceptance test. In this verified replay, ${measured.headline}`,
  customerQuestion: "When AI agents build application code, how much work is product logic and how much is database navigation?",
  proofSummary: {
    agent: `${artifact.agent.name} (${artifact.agent.model})`,
    scenario: `${artifact.scenario.name} / ${artifact.scenario.variant}`,
    orderId: artifact.outcome.orderId,
    mongoSeeded: `${sumCounts(mongoCollections)} generated records across ${Object.keys(mongoCollections).length} collections`,
    postgresSeeded: `${sumCounts(postgresTables)} generated rows across ${Object.keys(postgresTables).length} tables`,
    tokenDelta: summary.deltas.estimatedTranscriptTokenDelta,
    elapsedDeltaSeconds: Math.round(summary.deltas.elapsedMsDelta / 1000),
    diffBytesDelta: summary.deltas.diffBytesDelta,
    retrySignalDelta: summary.deltas.retrySignalDelta,
    monthlyDeltaUsd: summary.costModel.monthlyDeltaUsd
  },
  overheadReceipt: buildOverheadReceipt(),
  bareMetalTrace: buildBareMetalTrace(),
  costProjection: buildCostProjection(),
  publicPacket: buildPublicPacket(),
  proofChain: [
    "same-task",
    "frozen-start",
    "codex-traces",
    "code-diffs",
    "acceptance-tests",
    "database-replays",
    "portal-state",
    "design-review",
    "cost-model",
    "no-mock-contract"
  ],
  claims: [
    claimSameTask(),
    claimFrozenStart(),
    claimCodexTraces(),
    claimCodeDiffs(),
    claimAcceptanceTests(),
    claimDatabaseReplays(),
    claimPortalState(),
    claimDesignReview(),
    claimCostModel(),
    claimNoMockContract()
  ],
  shareText: [
    "MongoDB AI Build Cost Replay: verified Codex run.",
    `Scenario: ${artifact.scenario.name} / ${artifact.scenario.variant}, order ${artifact.outcome.orderId}.`,
    `MongoDB local service: ${sumCounts(mongoCollections)} generated records across ${Object.keys(mongoCollections).length} collections.`,
    `Postgres local service: ${sumCounts(postgresTables)} generated rows across ${Object.keys(postgresTables).length} tables.`,
    `Measured delta in this run: ${measured.shareLine}`,
    "Scope: one verified Codex replay pair; Claude Code and Cursor require their own verified lanes before being claimed."
  ].join("\n")
};

writeJson(bundlePath, bundle);
console.log(`Public evidence bundle emitted: ${bundlePath}`);

function claimSameTask() {
  const mongoPrompt = evidenceText(summary.lanes.mongo.artifacts.prompt);
  const postgresPrompt = evidenceText(summary.lanes.postgres.artifacts.prompt);
  return {
    id: "same-task",
    label: "Same feature request",
    question: "Was the task identical?",
    reason: "Fairness has to be proven before any speed, token, or cost metric deserves attention.",
    verdict: "Same business task and acceptance criteria; only the database-native rule differs.",
    kind: "text-pair",
    sources: [
      source(summary.lanes.mongo.artifacts.prompt),
      source(summary.lanes.postgres.artifacts.prompt)
    ],
    panels: [
      { label: "MongoDB prompt", language: "text", body: mongoPrompt.body },
      { label: "Postgres prompt", language: "text", body: postgresPrompt.body }
    ]
  };
}

function claimFrozenStart() {
  return {
    id: "frozen-start",
    label: "Same missing workflow",
    question: "Did both apps start without the feature?",
    reason: "This proves the accepted run started from a missing workflow instead of a prebuilt demo path.",
    verdict: "Both workspaces start with failing acceptance before Codex changes production code.",
    kind: "text-pair",
    sources: [
      source("instrumented-agent-runs/order-exception-codex-v1/mongo/tests-before.log"),
      source("instrumented-agent-runs/order-exception-codex-v1/postgres/tests-before.log")
    ],
    panels: [
      { label: "MongoDB before test", language: "text", body: evidenceText("instrumented-agent-runs/order-exception-codex-v1/mongo/tests-before.log").body },
      { label: "Postgres before test", language: "text", body: evidenceText("instrumented-agent-runs/order-exception-codex-v1/postgres/tests-before.log").body }
    ]
  };
}

function claimCodexTraces() {
  return {
    id: "codex-traces",
    label: "Captured Codex traces",
    question: "Are these real agent runs?",
    reason: "The trace is the raw event stream behind the token, elapsed-time, and retry claims.",
    verdict: `Both lanes preserve Codex JSONL/stdout, stderr, elapsed time, and CLI metadata. The Postgres lane consumed ${summary.deltas.estimatedTranscriptTokenDelta.toLocaleString("en-US")} more estimated transcript tokens in this captured pair.`,
    kind: "trace",
    metricRows: [
      metric("MongoDB", `${summary.lanes.mongo.estimatedTranscriptTokens.toLocaleString("en-US")} est. tokens`, `${Math.round(summary.lanes.mongo.elapsedMs / 1000)}s`, `${summary.lanes.mongo.retrySignals} retry signals`),
      metric("Postgres", `${summary.lanes.postgres.estimatedTranscriptTokens.toLocaleString("en-US")} est. tokens`, `${Math.round(summary.lanes.postgres.elapsedMs / 1000)}s`, `${summary.lanes.postgres.retrySignals} retry signals`)
    ],
    sources: [
      source(summary.lanes.mongo.artifacts.rawTranscript),
      source(summary.lanes.mongo.artifacts.stderr),
      source(summary.lanes.postgres.artifacts.rawTranscript),
      source(summary.lanes.postgres.artifacts.stderr)
    ],
    panels: [
      { label: "MongoDB trace excerpt", language: "jsonl", body: traceExcerpt(summary.lanes.mongo.artifacts.rawTranscript) },
      { label: "MongoDB stderr excerpt", language: "text", body: evidenceText(summary.lanes.mongo.artifacts.stderr, 10000).body },
      { label: "Postgres trace excerpt", language: "jsonl", body: traceExcerpt(summary.lanes.postgres.artifacts.rawTranscript) },
      { label: "Postgres stderr excerpt", language: "text", body: evidenceText(summary.lanes.postgres.artifacts.stderr, 10000).body }
    ]
  };
}

function claimCodeDiffs() {
  return {
    id: "code-diffs",
    label: "Code changes",
    question: "What code did the agent actually change?",
    reason: "The diff exposes implementation footprint, review burden, and whether the agent changed production code or test scaffolding.",
    verdict: `Codex changed ${summary.lanes.mongo.filesChanged} MongoDB file(s) and ${summary.lanes.postgres.filesChanged} Postgres file(s). ${measured.diffSentence}.`,
    kind: "diff",
    metricRows: [
      metric("MongoDB", `${summary.lanes.mongo.diffBytes.toLocaleString("en-US")} diff bytes`, `${summary.lanes.mongo.filesChanged} file`, summary.lanes.mongo.changedFiles.join(", ")),
      metric("Postgres", `${summary.lanes.postgres.diffBytes.toLocaleString("en-US")} diff bytes`, `${summary.lanes.postgres.filesChanged} file`, summary.lanes.postgres.changedFiles.join(", "))
    ],
    sources: [
      source(summary.lanes.mongo.artifacts.diff),
      source(summary.lanes.postgres.artifacts.diff)
    ],
    panels: [
      { label: "MongoDB diff", language: "diff", body: evidenceText(summary.lanes.mongo.artifacts.diff).body },
      { label: "Postgres diff", language: "diff", body: evidenceText(summary.lanes.postgres.artifacts.diff).body }
    ]
  };
}

function claimAcceptanceTests() {
  return {
    id: "acceptance-tests",
    label: "Same acceptance passed",
    question: "Did both apps ship the same outcome?",
    reason: "The comparison only matters if both lanes reached the same tested customer outcome.",
    verdict: "Both lanes pass the same acceptance assertions after the accepted Codex run.",
    kind: "test",
    sources: [
      source(summary.lanes.mongo.artifacts.tests),
      source(summary.lanes.mongo.artifacts.acceptance),
      source(summary.lanes.postgres.artifacts.tests),
      source(summary.lanes.postgres.artifacts.acceptance)
    ],
    panels: [
      { label: "MongoDB tests", language: "text", body: evidenceText(summary.lanes.mongo.artifacts.tests).body },
      { label: "MongoDB acceptance JSON", language: "json", body: prettyJson(summary.lanes.mongo.artifacts.acceptance) },
      { label: "Postgres tests", language: "text", body: evidenceText(summary.lanes.postgres.artifacts.tests).body },
      { label: "Postgres acceptance JSON", language: "json", body: prettyJson(summary.lanes.postgres.artifacts.acceptance) }
    ]
  };
}

function claimDatabaseReplays() {
  return {
    id: "database-replays",
    label: "Local database replay",
    question: "Did this touch real databases?",
    reason: "This proves the scenario records were seeded into real local database services and replayed there.",
    verdict: "The proof runners seed real local MongoDB and Postgres services, execute the workflow, and capture before/after workflow state.",
    kind: "database",
    metricRows: [
      metric("MongoDB seeded dataset", `${sumCounts(mongoCollections)} generated records`, `${Object.keys(mongoCollections).length} collections`, mongoProof.mongoUri),
      metric("Postgres seeded dataset", `${sumCounts(postgresTables)} generated rows`, `${Object.keys(postgresTables).length} tables`, `${postgresProof.postgresContainer}/${postgresProof.postgresDb}`)
    ],
    sources: [
      source(mongoProofPath),
      source(postgresProofPath),
      source("data/generated/mongodb/collections.json"),
      source("data/generated/postgres/tables.json")
    ],
    panels: [
      { label: "MongoDB local DB proof", language: "json", body: JSON.stringify(mongoProof, null, 2) },
      { label: "Postgres local DB proof", language: "json", body: JSON.stringify(postgresProof, null, 2) }
    ]
  };
}

function claimPortalState() {
  return {
    id: "portal-state",
    label: "Shipped workflow state",
    question: "What changed for the end user?",
    reason: "The before/after workflow state makes the shipped result inspectable before discussing tokens or architecture.",
    verdict: "Both lanes render the same before/after workflow state from accepted run artifacts and local database proof files.",
    kind: "state",
    sources: [
      source("instrumented-agent-runs/order-exception-codex-v1/mongo/workspace/artifacts/customer-portal-before-after.json"),
      source("instrumented-agent-runs/order-exception-codex-v1/postgres/workspace/artifacts/customer-portal-before-after.json"),
      source(mongoProofPath),
      source(postgresProofPath),
      source(join(outDir, "mongo-workflow-state.svg")),
      source(join(outDir, "postgres-workflow-state.svg"))
    ],
    images: [
      { label: "MongoDB rendered workflow state", src: portalStateRefs.mongo },
      { label: "Postgres rendered workflow state", src: portalStateRefs.postgres }
    ],
    panels: [
      { label: "MongoDB state JSON", language: "json", body: prettyJson("instrumented-agent-runs/order-exception-codex-v1/mongo/workspace/artifacts/customer-portal-before-after.json") },
      { label: "Postgres state JSON", language: "json", body: prettyJson("instrumented-agent-runs/order-exception-codex-v1/postgres/workspace/artifacts/customer-portal-before-after.json") },
      { label: "MongoDB local DB proof", language: "json", body: JSON.stringify(mongoProof, null, 2) },
      { label: "Postgres local DB proof", language: "json", body: JSON.stringify(postgresProof, null, 2) }
    ]
  };
}

function claimDesignReview() {
  return {
    id: "design-review",
    label: "Baseline credibility",
    question: "Is the Postgres baseline credible?",
    reason: "This is the guardrail against dismissing the result as an intentionally weak relational baseline.",
    verdict: "The review states why both sides are database-native and why schema-identical comparison would be less fair.",
    kind: "review",
    sources: [source(designReviewPath)],
    panels: [
      { label: "MongoDB rationale", language: "text", body: designReview.mongoRationale },
      { label: "Postgres rationale", language: "text", body: designReview.postgresRationale },
      { label: "Trade-off", language: "text", body: designReview.tradeoff },
      { label: "Full review JSON", language: "json", body: JSON.stringify(designReview, null, 2) }
    ]
  };
}

function claimCostModel() {
  return {
    id: "cost-model",
    label: "Cost model",
    question: "What does the projection assume?",
    reason: "Finance needs the assumptions separated from the measured replay delta before any budget conversation is honest.",
    verdict: `The replay projects ${formatMoney(summary.costModel.perTaskDeltaUsd)} per task and ${formatMoneyShort(summary.costModel.monthlyDeltaUsd)} monthly under visible assumptions, not guaranteed savings.`,
    kind: "cost",
    metricRows: [
      metric("Token delta", `${summary.costModel.tokenDelta.toLocaleString("en-US")} est. tokens`, `${formatMoney(summary.costModel.modelDeltaUsd)} model delta`, "$10 / 1M context tokens"),
      metric("Review delta", `${summary.costModel.reviewMinutesDelta} minute`, `${formatMoney(summary.costModel.reviewDeltaUsd)} review delta`, "$150 / hour"),
      metric("Monthly projection", `${summary.costModel.assumptions.agentTasksPerMonth.toLocaleString("en-US")} tasks`, formatMoneyShort(summary.costModel.monthlyDeltaUsd), "assumption-based")
    ],
    sources: [source(summaryPath)],
    panels: [
      { label: "Cost model JSON", language: "json", body: JSON.stringify(summary.costModel, null, 2) }
    ]
  };
}

function claimNoMockContract() {
  return {
    id: "no-mock-contract",
    label: "Verified data contract",
    question: "Can this page render unverified data?",
    reason: "Public proof must fail closed when evidence is missing, instead of quietly showing placeholder claims.",
    verdict: "The verified replay disables unverified runtime data, the console fails closed, and the evidence gate blocks retired prototype proof text.",
    kind: "contract",
    sources: [
      source(verifiedPath),
      source(manifestPath),
      source("scripts/check-no-mock-data.mjs")
    ],
    panels: [
      { label: "Runtime data contract", language: "json", body: JSON.stringify(artifact.dataContract, null, 2) },
      { label: "Verified manifest", language: "json", body: JSON.stringify(manifest, null, 2) },
      { label: "Evidence gate", language: "text", body: "The gate is hash-locked as a source file and executed by npm run proof:no-mock. It blocks retired prototype artifacts, unverified fallback proof, and verified replay promotion without dataContract.mockDataAllowed === false." }
    ]
  };
}

function buildPublicPacket() {
  return {
    title: "AI Agents Pay Your Schema Tax",
    subtitle: "A public, evidence-backed replay of one ordinary application feature built against MongoDB and Postgres.",
    primaryMessage: `This is not an AI app demo. It is an ordinary software change built with an AI coding agent. The agent does not just generate code; it reads your schema, infers relationships, chases state, repairs mistakes, and spends tokens doing it. This verified replay shipped the same workflow twice and captured the bill: ${measured.shareLine}`,
    resultCards: [
      { label: "Transcript delta", value: `${summary.deltas.estimatedTranscriptTokenDelta.toLocaleString("en-US")} est. tokens`, evidenceId: "codex-traces" },
      { label: "Elapsed delta", value: `${Math.round(summary.deltas.elapsedMsDelta / 1000)} seconds`, evidenceId: "codex-traces" },
      { label: "Diff delta", value: measured.diffCard, evidenceId: "code-diffs" },
      { label: "Monthly projection", value: formatMoneyShort(summary.costModel.monthlyDeltaUsd), evidenceId: "cost-model" }
    ],
    buyerPath: [
      { label: "Executives", copy: "Start with the shipped workflow and measured deltas. This is not a benchmark chart; it is a replayable application change." },
      { label: "Engineering", copy: "Open trace, diff, tests, and DB proof. The claim should survive technical inspection." },
      { label: "Architecture", copy: "Open the baseline credibility review. The comparison is database-native, not schema-identical and not engineered to embarrass SQL." },
      { label: "Finance", copy: "Open the cost model. The projection separates measured deltas from visible assumptions." }
    ],
    proofRules: [
      "Same customer request and acceptance criteria.",
      "Both workspaces start with failing acceptance.",
      "Codex held constant across both lanes.",
      "No hand edits after the accepted run.",
      "Generated records are seeded into real local MongoDB and Postgres services.",
      "The public page fails closed if verified evidence is unavailable."
    ],
    caveats: [
      "This proves one Codex replay pair, not every agent or every workload.",
      "Claude Code and Cursor require their own verified lanes before being claimed.",
      "Cost projection depends on visible assumptions and must not be framed as guaranteed savings.",
      "Scenario records are generated and seeded into real local services; no customer production data is used."
    ],
    nextValidation: [
      "Add Claude Code with the same instrumented run contract.",
      "Add Cursor with the same evidence gates.",
      "Add Enterprise SQL Sprawl only after the clean Postgres baseline stays credible.",
      "Move from local static proof lab to hosted public release with signed evidence artifacts."
    ]
  };
}

function buildOverheadReceipt() {
  const mongoObjects = Object.keys(mongoCollections).length;
  const postgresObjects = Object.keys(postgresTables).length;
  const schemaObjectDelta = postgresObjects - mongoObjects;
  const receiptItems = [
    {
      id: "schema-surface",
      label: "Schema surface",
      value: `${postgresObjects} tables vs ${mongoObjects} collections`,
      delta: `${schemaObjectDelta} more database objects`,
      publicMeaning: "More objects means more context the agent must inspect, infer, and keep consistent before it can safely change product behavior.",
      evidenceId: "database-replays"
    },
    {
      id: "context-spend",
      label: "Context spend",
      value: `${summary.deltas.estimatedTranscriptTokenDelta.toLocaleString("en-US")} more estimated tokens`,
      delta: "Extra transcript context",
      publicMeaning: "The model spent more context budget getting to the same accepted workflow.",
      evidenceId: "codex-traces"
    },
    {
      id: "elapsed-work",
      label: "Elapsed agent work",
      value: `${Math.round(summary.deltas.elapsedMsDelta / 1000)} more seconds`,
      delta: "More wall-clock run time",
      publicMeaning: "More agent time means slower feedback loops and more time for humans to wait, watch, or intervene.",
      evidenceId: "codex-traces"
    },
    {
      id: "change-footprint",
      label: "Change footprint",
      value: measured.diffCard,
      delta: measured.diffDelta,
      publicMeaning: measured.diffMeaning,
      evidenceId: "code-diffs"
    },
    {
      id: "human-review",
      label: "Human review carry",
      value: `${summary.costModel.reviewMinutesDelta} extra review minute`,
      delta: "Assumption-backed review burden",
      publicMeaning: "The cost model separates measured replay deltas from the human review assumption so the budget discussion stays honest.",
      evidenceId: "cost-model"
    }
  ];

  return {
    title: "Agent Overhead Receipt",
    headline: "Same shipped workflow. Extra work charged to schema complexity.",
    framing: "This is not a leaderboard. It is the itemized bill from one verified Codex replay pair.",
    outcome: "Both lanes passed the same acceptance contract after starting from the same missing workflow.",
    totals: [
      { label: "Context", value: `${summary.deltas.estimatedTranscriptTokenDelta.toLocaleString("en-US")} est. tokens`, evidenceId: "codex-traces" },
      { label: "Time", value: `${Math.round(summary.deltas.elapsedMsDelta / 1000)} seconds`, evidenceId: "codex-traces" },
      { label: "Diff", value: measured.diffCard, evidenceId: "code-diffs" }
    ],
    items: receiptItems
  };
}

function buildCostProjection() {
  return {
    measuredDeltas: {
      estimatedTranscriptTokens: summary.costModel.tokenDelta,
      reviewMinutes: summary.costModel.reviewMinutesDelta,
      retrySignals: summary.deltas.retrySignalDelta,
      elapsedSeconds: Math.round(summary.deltas.elapsedMsDelta / 1000),
      diffBytes: summary.deltas.diffBytesDelta
    },
    defaults: {
      tasksPerMonth: summary.costModel.assumptions.agentTasksPerMonth,
      modelCostPerMillionContextTokensUsd: summary.costModel.assumptions.blendedModelCostPerMillionContextTokensUsd,
      engineeringReviewRateUsdPerHour: summary.costModel.assumptions.engineeringReviewRateUsdPerHour
    },
    formula: {
      modelDeltaUsd: "estimatedTranscriptTokens / 1,000,000 * modelCostPerMillionContextTokensUsd",
      reviewDeltaUsd: "reviewMinutes / 60 * engineeringReviewRateUsdPerHour",
      perTaskDeltaUsd: "modelDeltaUsd + reviewDeltaUsd",
      monthlyDeltaUsd: "perTaskDeltaUsd * tasksPerMonth"
    },
    caveat: "Only the replay deltas are measured. The monthly projection changes with the assumptions selected on the page."
  };
}

function buildBareMetalTrace() {
  return {
    title: "Bare Metal Agent Trace",
    skepticStandard: "This is a replay of captured execution, not an in-browser simulation. It proves one verified replay pair, not every workload. A new live run may differ because coding agents are nondeterministic, but the prompt, targets, local DB proof, raw traces, diffs, tests, and gates are all inspectable.",
    lanes: {
      mongo: bareMetalLane("mongo", summary.lanes.mongo),
      postgres: bareMetalLane("postgres", summary.lanes.postgres)
    },
    reproducibility: [
      { label: "Verify promoted proof", command: "npm run proof:verified" },
      { label: "Replay local DB proofs", command: "npm run proof:all" },
      { label: "Prepare fresh target workspaces", command: "npm run instrumented:prepare" },
      { label: "Rerun Codex lanes", command: "npm run instrumented:codex:all" }
    ]
  };
}

function bareMetalLane(id, laneSummary) {
  const events = readJsonl(laneSummary.artifacts.rawTranscript);
  const commands = events
    .filter((event) => event.type === "item.completed" && event.item?.type === "command_execution")
    .map((event, index) => ({
      index: index + 1,
      command: event.item.command,
      exitCode: event.item.exit_code,
      status: event.item.status,
      outputExcerpt: String(event.item.aggregated_output || "").slice(0, 2200)
    }));
  const failedCommands = commands.filter((command) => Number(command.exitCode) !== 0);
  const agentMessages = events
    .filter((event) => event.type === "item.completed" && event.item?.type === "agent_message")
    .map((event) => event.item.text)
    .filter(Boolean);
  return {
    label: id === "mongo" ? "MongoDB" : "Postgres",
    status: laneSummary.status,
    cliVersion: laneSummary.cliVersion,
    elapsedSeconds: Math.round(laneSummary.elapsedMs / 1000),
    estimatedTranscriptTokens: laneSummary.estimatedTranscriptTokens,
    transcriptBytes: laneSummary.transcriptBytes,
    diffBytes: laneSummary.diffBytes,
    filesChanged: laneSummary.filesChanged,
    changedFiles: laneSummary.changedFiles,
    retrySignals: laneSummary.retrySignals,
    commandCount: commands.length,
    failedCommandCount: failedCommands.length,
    rawEventCount: events.length,
    testStatus: laneSummary.testStatus,
    sources: [
      source(laneSummary.artifacts.rawTranscript),
      source(laneSummary.artifacts.stderr),
      source(laneSummary.artifacts.diff),
      source(laneSummary.artifacts.tests),
      source(laneSummary.artifacts.acceptance)
    ],
    commands,
    failedCommands,
    agentMessages
  };
}

function source(path) {
  return {
    path,
    bytes: existsSync(path) ? readFileSync(path).byteLength : 0,
    sha256: existsSync(path) ? sha256(path) : ""
  };
}

function metric(label, value, detail, note) {
  return { label, value, detail, note };
}

function measuredNarrative() {
  const tokenDelta = summary.deltas.estimatedTranscriptTokenDelta;
  const elapsedDelta = Math.round(summary.deltas.elapsedMsDelta / 1000);
  const diffDelta = summary.deltas.diffBytesDelta;
  const retryDelta = summary.deltas.retrySignalDelta;
  const tokenSentence = signedLaneSentence(tokenDelta, "estimated transcript token", "estimated transcript tokens");
  const elapsedSentence = signedLaneSentence(elapsedDelta, "second", "seconds");
  const retrySentence = signedLaneSentence(retryDelta, "retry signal", "retry signals");
  const diff = signedLaneSentence(diffDelta, "diff byte", "diff bytes");

  return {
    headline: `${tokenSentence}, ${elapsedSentence}, and ${retrySentence}. ${diff}.`,
    shareLine: `${tokenSentence}; ${elapsedSentence}; ${retrySentence}; ${diff}.`,
    diffSentence: diff,
    diffCard: signedCard(diffDelta, "bytes"),
    diffDelta: diffDelta > 0 ? "Larger Postgres implementation footprint" : diffDelta < 0 ? "Larger MongoDB implementation footprint in this run" : "Equal implementation footprint",
    diffMeaning: diffDelta > 0
      ? "More changed code is more review surface for the same customer-visible outcome."
      : diffDelta < 0
        ? "This run does not claim a diff-size win for MongoDB. It keeps the unfavorable diff metric visible while the token, elapsed-time, and retry deltas remain measured."
        : "This run shows no diff-size difference, so the cost model should not lean on diff size."
  };
}

function signedLaneSentence(value, singular, plural) {
  const abs = Math.abs(value);
  const unit = abs === 1 ? singular : plural;
  if (value > 0) return `Postgres required ${abs.toLocaleString("en-US")} more ${unit}`;
  if (value < 0) return `MongoDB required ${abs.toLocaleString("en-US")} more ${unit}`;
  return `both lanes required the same ${plural}`;
}

function signedCard(value, unit) {
  if (value > 0) return `Postgres +${value.toLocaleString("en-US")} ${unit}`;
  if (value < 0) return `MongoDB +${Math.abs(value).toLocaleString("en-US")} ${unit}`;
  return `0 ${unit}`;
}

function evidenceText(path, max = 18000) {
  const body = readFileSync(path, "utf8");
  return {
    path,
    body: body.length > max ? `${body.slice(0, max)}\n\n[truncated in public UI; full source is hash-locked at ${path}]` : body
  };
}

function traceExcerpt(path) {
  const lines = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const interesting = lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((event) => event.type === "item.completed" || event.type === "turn.completed" || event.type === "error")
    .slice(0, 14)
    .map((event) => JSON.stringify(event));
  return interesting.join("\n");
}

function prettyJson(path) {
  return JSON.stringify(readJson(path), null, 2);
}

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function copyEvidenceAsset(sourcePath, targetName) {
  const targetPath = join(outDir, targetName || basename(sourcePath));
  copyFileSync(sourcePath, targetPath);
  return `evidence/${runId}/${basename(targetPath)}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sumCounts(collectionsOrTables = {}) {
  return Object.values(collectionsOrTables).reduce((total, rows) => total + (Array.isArray(rows) ? rows.length : Number(rows || 0)), 0);
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
