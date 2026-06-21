#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { generatedFixturePath, generateFixtureArtifacts, writeJson } from "./proof-fixtures.mjs";
import { applyMongoOrderException, buildMongoPortalView, mongoTouchedFiles } from "../targets/mongodb-app/src/order-exception-workflow.mjs";
import { applyPostgresOrderException, buildPostgresPortalView, postgresTouchedFiles } from "../targets/postgres-app/src/order-exception-workflow.mjs";
import { assertOrderExceptionAcceptance } from "../targets/shared/acceptance.mjs";

const now = "2026-06-16T12:00:00.000Z";
const outputDir = "data/generated/proof";
const replayPath = "prototypes/lab-console/replays/order-exception-codex-v1-candidate.json";

const { fixture, mongo, postgres } = generateFixtureArtifacts();
const mongoBefore = buildMongoPortalView(structuredClone(mongo), fixture.task.orderId);
const postgresBefore = buildPostgresPortalView(structuredClone(postgres), fixture.task.orderId);

const mongoRunDb = structuredClone(mongo);
const postgresRunTables = structuredClone(postgres);
const mongoPortal = applyMongoOrderException(mongoRunDb, fixture.task.orderId, now);
const postgresPortal = applyPostgresOrderException(postgresRunTables, fixture.task.orderId, now);
const acceptance = assertOrderExceptionAcceptance({ mongoPortal, postgresPortal, task: fixture.task });

const metrics = buildMetrics();
const costModel = buildCostModel(metrics);
const localProof = {
  fixtureVersion: fixture.scenarioVersion,
  generatedAt: now,
  acceptance,
  metrics,
  costModel,
  before: { mongo: mongoBefore, postgres: postgresBefore },
  after: { mongo: mongoPortal, postgres: postgresPortal }
};

mkdirSync(outputDir, { recursive: true });
writeJson(`${outputDir}/order-exception-acceptance.json`, acceptance);
writeJson(`${outputDir}/metrics.json`, metrics);
writeJson(`${outputDir}/cost-model.json`, costModel);
writeJson(`${outputDir}/order-exception-local-proof.json`, localProof);

const mongoDbProof = matchingProof(readOptionalJson(`${outputDir}/mongodb-local-db-proof.json`), fixture.scenarioVersion);
const postgresDbProof = matchingProof(readOptionalJson(`${outputDir}/postgres-local-db-proof.json`), fixture.scenarioVersion);
const screenshotProofPath = `${outputDir}/screenshots/customer-portal-before-after.png`;
const screenshotProofCaptured = existsSync(screenshotProofPath);
const evidenceManifest = buildEvidenceManifest({ artifactId: "order-exception-codex-v1-candidate", mongoDbProof, postgresDbProof, screenshotProofCaptured, screenshotProofPath });
writeJson(`${outputDir}/evidence-manifest.json`, evidenceManifest);

const artifact = buildReplayArtifact({ fixture, mongoBefore, postgresBefore, mongoPortal, postgresPortal, acceptance, metrics, costModel, evidenceManifest, mongoDbProof, postgresDbProof, screenshotProofCaptured, screenshotProofPath });
writeJson(replayPath, artifact);

console.log(`Local proof candidate emitted: ${replayPath}`);
console.log(`Acceptance: ${acceptance.status}`);
console.log(`Context estimate: MongoDB ${formatNumber(metrics.mongo.contextTokens)} tokens / Postgres ${formatNumber(metrics.postgres.contextTokens)} tokens`);
console.log(`Cost projection: ${formatMoney(costModel.perTaskDeltaUsd)} per task / ${formatMoney(costModel.monthlyDeltaUsd)} monthly`);

function buildMetrics() {
  const mongoDesign = readJson("targets/mongodb-app/schema/design.json");
  const pgDesign = readJson("targets/postgres-app/schema/design.json");
  const pgSchemaSql = readFileSync("targets/postgres-app/schema/schema.sql", "utf8");

  const mongoContextBytes = contextBytes([
    "targets/mongodb-app/schema/design.json",
    "targets/mongodb-app/src/order-exception-workflow.mjs",
    "targets/shared/acceptance.mjs",
    "data/generated/mongodb/collections.json"
  ]);
  const pgContextBytes = contextBytes([
    "targets/postgres-app/schema/design.json",
    "targets/postgres-app/schema/schema.sql",
    "targets/postgres-app/src/order-exception-workflow.mjs",
    "targets/shared/acceptance.mjs",
    "data/generated/postgres/tables.json"
  ]);

  const mongoSchemaObjects = mongoDesign.collections.length;
  const pgSchemaObjects = pgDesign.tables.length;
  const mongoAccessObjects = mongoDesign.orderExceptionAccessPath.length;
  const pgAccessObjects = pgDesign.orderExceptionAccessPath.length;

  return {
    generatedAt: now,
    mongo: {
      contextBytes: mongoContextBytes,
      contextTokens: estimateTokens(mongoContextBytes),
      schemaObjects: mongoSchemaObjects,
      accessObjects: mongoAccessObjects,
      touchedFiles: mongoTouchedFiles.length,
      touchedFileNames: mongoTouchedFiles,
      evidenceFiles: [
        "targets/mongodb-app/schema/design.json",
        "data/generated/mongodb/collections.json",
        "targets/mongodb-app/src/order-exception-workflow.mjs"
      ]
    },
    postgres: {
      contextBytes: pgContextBytes,
      contextTokens: estimateTokens(pgContextBytes),
      schemaObjects: pgSchemaObjects,
      accessObjects: pgAccessObjects,
      touchedFiles: postgresTouchedFiles.length,
      touchedFileNames: postgresTouchedFiles,
      evidenceFiles: [
        "targets/postgres-app/schema/design.json",
        "targets/postgres-app/schema/schema.sql",
        "data/generated/postgres/tables.json",
        "targets/postgres-app/src/order-exception-workflow.mjs"
      ],
      ddlBytes: Buffer.byteLength(pgSchemaSql, "utf8")
    }
  };
}

function buildCostModel(metrics) {
  const assumptions = {
    tokenEstimator: "ceil(utf8 context bytes / 4)",
    blendedModelCostPerMillionContextTokensUsd: 10,
    engineeringReviewRateUsdPerHour: 150,
    reviewMinutesPerExtraAccessObject: 1.25,
    reviewMinutesPerExtraSchemaObject: 0.35,
    agentTasksPerMonth: 4000
  };
  const contextTokenDelta = metrics.postgres.contextTokens - metrics.mongo.contextTokens;
  const accessObjectDelta = metrics.postgres.accessObjects - metrics.mongo.accessObjects;
  const schemaObjectDelta = metrics.postgres.schemaObjects - metrics.mongo.schemaObjects;
  const reviewMinutesDelta = Math.max(
    0,
    Math.round((accessObjectDelta * assumptions.reviewMinutesPerExtraAccessObject + schemaObjectDelta * assumptions.reviewMinutesPerExtraSchemaObject) * 10) / 10
  );
  const modelDeltaUsd = (contextTokenDelta / 1_000_000) * assumptions.blendedModelCostPerMillionContextTokensUsd;
  const reviewDeltaUsd = (reviewMinutesDelta / 60) * assumptions.engineeringReviewRateUsdPerHour;
  const perTaskDeltaUsd = modelDeltaUsd + reviewDeltaUsd;

  return {
    assumptions,
    contextTokenDelta,
    contextReductionPct: pct(metrics.postgres.contextTokens - metrics.mongo.contextTokens, metrics.postgres.contextTokens),
    schemaObjectDelta,
    accessObjectDelta,
    reviewMinutesDelta,
    modelDeltaUsd,
    reviewDeltaUsd,
    perTaskDeltaUsd,
    monthlyDeltaUsd: perTaskDeltaUsd * assumptions.agentTasksPerMonth
  };
}

function buildReplayArtifact({ fixture, mongoBefore, postgresBefore, mongoPortal, postgresPortal, acceptance, metrics, costModel, evidenceManifest, mongoDbProof, postgresDbProof, screenshotProofCaptured, screenshotProofPath }) {
  const score = scoreLanes(metrics);
  const scenarioLabel = `${fixture.scenarioName} / ${fixture.variant}`;
  const mongoDbProofCaptured = mongoDbProof?.status === "passed";
  const mongoDbProofLabel = mongoDbProofCaptured ? "Captured" : "Required";
  const mongoDbProofStatus = mongoDbProofCaptured ? "captured" : "required";
  const postgresDbProofCaptured = postgresDbProof?.status === "passed";
  const postgresDbProofLabel = postgresDbProofCaptured ? "Captured" : "Required";
  const postgresDbProofStatus = postgresDbProofCaptured ? "captured" : "required";
  const screenshotProofLabel = screenshotProofCaptured ? "Captured" : "Required";
  const screenshotProofStatus = screenshotProofCaptured ? "captured" : "required";

  return {
    schemaVersion: "0.2.0",
    artifactId: "order-exception-codex-v1-candidate",
    proofStatus: "candidate",
    scenario: {
      name: fixture.scenarioName,
      variant: fixture.variant,
      fixtureVersion: fixture.scenarioVersion
    },
    task: {
      headline: fixture.task.headline,
      request: fixture.task.request
    },
    agent: {
      name: "Codex",
      model: "local proof runner; live agent trace required before verified",
      constraint: "Codex lane reserved; local runner candidate"
    },
    fairnessContract: [
      "Same customer request",
      "Same canonical Scenario Fixture",
      "Same acceptance assertions",
      "Database-native projections generated from one fixture",
      "Live agent attempts must be counted before verified"
    ],
    outcome: {
      orderId: fixture.task.orderId,
      statusPill: `${acceptance.status.toUpperCase()} / local target adapters`,
      before: {
        title: mongoBefore.title,
        rows: [
          { label: "Status", value: mongoBefore.status, tone: "warn" },
          { label: "Owner", value: mongoBefore.owner },
          { label: "Next step", value: mongoBefore.nextStep },
          { label: "History", value: mongoBefore.history },
          { label: "Risk", value: mongoBefore.riskSummary },
          { label: "Tasks", value: mongoBefore.tasks }
        ]
      },
      after: {
        title: mongoPortal.title,
        rows: [
          { label: "Status", value: mongoPortal.status, tone: "warn" },
          { label: "Owner", value: mongoPortal.owner },
          { label: "Next step", value: mongoPortal.nextStep },
          { label: "History", value: mongoPortal.history, tone: "good" },
          { label: "Risk", value: mongoPortal.riskSummary, tone: "good" },
          { label: "Tasks", value: mongoPortal.tasks, tone: "good" }
        ]
      }
    },
    verdict: [
      { label: "Context estimate", value: `${costModel.contextReductionPct}% less` },
      { label: "Schema objects", value: `${costModel.schemaObjectDelta} fewer` },
      { label: "Review model", value: `${costModel.reviewMinutesDelta}m saved` },
      { label: "Monthly estimate", value: formatMoneyShort(costModel.monthlyDeltaUsd) }
    ],
    lanes: [
      buildLane({
        id: "mongo",
        name: "MongoDB",
        model: "Document model / customer 360 aggregate",
        score: score.mongo,
        metrics: metrics.mongo,
        maxContextTokens: metrics.postgres.contextTokens,
        maxSchemaObjects: metrics.postgres.schemaObjects,
        maxAccessObjects: metrics.postgres.accessObjects,
        events: [
          ["00:00", "Reads customer 360 aggregate", "Contract tier, health, billing summary, usage summary, team, and support signals are already shaped around the escalation workflow.", "schema", true],
          ["00:01", "Checks delayed order and risk signals", "The order aggregate carries shipment, payment, line item, and status context while account summaries carry CRM risk.", "crm", false],
          ["00:02", "Creates escalation, owner tasks, and portal state", "The customer-visible escalation state and owner groups are localized to the account/order path.", "diff", false],
          ["00:03", "Appends audit event and passes acceptance", "Same customer portal assertions pass from the MongoDB projection.", "green", false]
        ]
      }),
      buildLane({
        id: "pg",
        name: "Postgres",
        model: "Clean normalized customer-360 relational baseline",
        score: score.postgres,
        metrics: metrics.postgres,
        maxContextTokens: metrics.postgres.contextTokens,
        maxSchemaObjects: metrics.postgres.schemaObjects,
        maxAccessObjects: metrics.postgres.accessObjects,
        events: [
          ["00:00", "Maps normalized customer graph", "The workflow touches account, contract, team, order, shipment, support, invoice, usage, compliance, escalation, task, audit, and portal tables.", "schema", true],
          ["00:02", "Inserts escalation and task rows", "Escalation state spans customer_escalations, escalation_risk_factors, escalation_tasks, task assignments, portal messages, legal, finance, status, and audit tables.", "migration", false],
          ["00:03", "Builds customer portal projection", "The portal view depends on reassembling escalation, risk, task, audit, support case, and account context.", "join", false],
          ["00:04", "Passes the same acceptance contract", "The relational target is credible and behavior-equivalent, with more schema context to inspect.", "green", false]
        ]
      })
    ],
    scorecard: [
      { label: "Context cost", value: `MongoDB -${costModel.contextReductionPct}% est.` },
      { label: "Schema review", value: `${costModel.schemaObjectDelta} fewer objects` },
      { label: "Access path", value: `${costModel.accessObjectDelta} fewer objects` },
      { label: "Quality confidence", value: "Same escalation acceptance passed" },
      { label: "Governance and safety", value: "Live trace required before verified" }
    ],
    costProjection: {
      assumptions: `Configurable candidate model: ${formatNumber(costModel.assumptions.agentTasksPerMonth)} agent tasks/month, ${formatMoney(costModel.assumptions.engineeringReviewRateUsdPerHour)}/hour review, ${formatMoney(costModel.assumptions.blendedModelCostPerMillionContextTokensUsd)}/1M context tokens.`,
      figures: [
        { label: "Per task", value: formatMoney(costModel.perTaskDeltaUsd) },
        { label: "Monthly", value: formatMoneyShort(costModel.monthlyDeltaUsd) }
      ]
    },
    proofPacket: {
      summary: "This is now a local proof candidate for the harder Customer 360 Escalation workflow: fixture, database-native projections, target adapters, acceptance test, metrics, and cost model are captured. Live agent trace remains required before verified.",
      items: [
        { label: "Fairness Contract", value: "Captured" },
        { label: "Independent Design Review", value: "Required" },
        { label: "Local target adapters", value: "Captured" },
        { label: "MongoDB local DB replay", value: mongoDbProofLabel },
        { label: "Postgres local DB replay", value: postgresDbProofLabel },
        { label: "Acceptance tests", value: "Captured" },
        { label: "Browser screenshot", value: screenshotProofLabel },
        { label: "Raw agent trace + diffs", value: "Required" }
      ]
    },
    caseFile: {
      fairnessControls: [
        { label: "Task prompt", value: fixture.task.request, status: "captured" },
        { label: "Scenario Fixture", value: fixture.scenarioVersion, status: "captured" },
        { label: "Acceptance contract", value: acceptance.assertions.join("; "), status: "captured" },
        { label: "Database-native models", value: "MongoDB document aggregate and clean normalized Postgres baseline", status: "captured" },
        { label: "Live agent attempts", value: "Required before verified; candidate uses local target adapters", status: "required" }
      ],
      designReview: {
        status: "required",
        reviewer: "Independent design review required before verified",
        mongoRationale: "The MongoDB target follows the document-model principle that data accessed together should be stored together: customer account, contract, health, team, billing summary, usage summary, support summary, compliance summary, and current escalation are co-located for the hot Customer 360 escalation path while unbounded streams remain separate.",
        postgresRationale: "The Postgres target is a clean normalized baseline with explicit tables and foreign keys for accounts, contacts, contracts, teams, orders, shipments, support cases, invoices, usage snapshots, compliance reviews, escalation policies, tasks, portal messages, audit, SLA, and visibility concerns.",
        tradeoff: "The proof compares database-native designs. Identical schemas would be less fair because they would punish one model for the other's natural shape."
      },
      evidenceLedger: [
        { claim: `Evidence manifest locks ${evidenceManifest.files.length} source and proof files with SHA-256`, source: "data/generated/proof/evidence-manifest.json", status: "captured" },
        { claim: `Context estimate: MongoDB ${formatNumber(metrics.mongo.contextTokens)} vs Postgres ${formatNumber(metrics.postgres.contextTokens)} tokens`, source: "data/generated/proof/metrics.json", status: "captured" },
        { claim: `Schema objects: MongoDB ${metrics.mongo.schemaObjects} collections vs Postgres ${metrics.postgres.schemaObjects} tables`, source: "targets/mongodb-app/schema/design.json; targets/postgres-app/schema/design.json", status: "captured" },
        { claim: `Access path: MongoDB ${metrics.mongo.accessObjects} collections vs Postgres ${metrics.postgres.accessObjects} tables`, source: "targets/mongodb-app/schema/design.json; targets/postgres-app/schema/design.json", status: "captured" },
        { claim: "Both database-native target adapters pass the same Customer 360 escalation acceptance assertions", source: "data/generated/proof/order-exception-acceptance.json", status: "captured" },
        { claim: "MongoDB local database seed and workflow replay", source: "data/generated/proof/mongodb-local-db-proof.json", status: mongoDbProofStatus },
        { claim: "Postgres local database seed and workflow replay", source: "data/generated/proof/postgres-local-db-proof.json", status: postgresDbProofStatus },
        { claim: `Cost projection: ${formatMoney(costModel.perTaskDeltaUsd)} per task candidate delta`, source: "data/generated/proof/cost-model.json", status: "captured" },
        { claim: "Captured Codex trace, inspected files, retries, token counts, and code diffs", source: "instrumented-agent-run/", status: "required" },
        { claim: "Independent design review by MongoDB and Postgres reviewers or rubric", source: "design-review/", status: "required" },
        { claim: "Browser screenshot for customer portal before and after", source: screenshotProofPath, status: screenshotProofStatus }
      ]
    },
    caveat: `Candidate generated from local file-backed target adapters for ${scenarioLabel}. Metrics are evidence-backed estimates, not a verified live agent replay.`
  };
}

function buildEvidenceManifest({ artifactId, mongoDbProof, postgresDbProof, screenshotProofCaptured, screenshotProofPath }) {
  const files = [
    ["scenario", "scenarios/customer-order-lifecycle/scenario-definition.json"],
    ["mongodb-schema-design", "targets/mongodb-app/schema/design.json"],
    ["postgres-schema-design", "targets/postgres-app/schema/design.json"],
    ["postgres-ddl", "targets/postgres-app/schema/schema.sql"],
    ["mongodb-target-adapter", "targets/mongodb-app/src/order-exception-workflow.mjs"],
    ["postgres-target-adapter", "targets/postgres-app/src/order-exception-workflow.mjs"],
    ["acceptance-contract", "targets/shared/acceptance.mjs"],
    ["canonical-fixture", generatedFixturePath],
    ["mongodb-projection", "data/generated/mongodb/collections.json"],
    ["postgres-projection", "data/generated/postgres/tables.json"],
    ["acceptance-evidence", "data/generated/proof/order-exception-acceptance.json"],
    ["metrics-evidence", "data/generated/proof/metrics.json"],
    ["cost-model", "data/generated/proof/cost-model.json"],
    ["local-proof", "data/generated/proof/order-exception-local-proof.json"]
  ];

  if (mongoDbProof?.status === "passed") {
    files.push(
      ["mongodb-local-db-proof", "data/generated/proof/mongodb-local-db-proof.json"],
      ["mongodb-seed-script", "data/generated/mongodb/seed.mongo.js"],
      ["mongodb-local-runner", "data/generated/mongodb/run-proof.mongo.js"]
    );
  }
  if (postgresDbProof?.status === "passed") {
    files.push(
      ["postgres-local-db-proof", "data/generated/proof/postgres-local-db-proof.json"],
      ["postgres-seed-sql", "data/generated/postgres/seed.sql"],
      ["postgres-local-runner", "data/generated/postgres/run-proof.sql"]
    );
  }
  if (screenshotProofCaptured) {
    files.push(["browser-screenshot", screenshotProofPath]);
  }

  return {
    artifactId,
    generatedAt: now,
    proofStatus: "candidate",
    hashAlgorithm: "sha256",
    files: files.map(([role, path]) => fileManifestEntry(role, path))
  };
}

function fileManifestEntry(role, path) {
  const contents = readFileSync(path);
  return {
    role,
    path,
    bytes: contents.byteLength,
    sha256: createHash("sha256").update(contents).digest("hex")
  };
}

function buildLane({ id, name, model, score, metrics, maxContextTokens, maxSchemaObjects, maxAccessObjects, events }) {
  return {
    id,
    name,
    model,
    score,
    meters: [
      { label: "Context est.", value: `${formatNumber(metrics.contextTokens)}`, width: width(metrics.contextTokens, maxContextTokens) },
      { label: "Schema objects", value: String(metrics.schemaObjects), width: width(metrics.schemaObjects, maxSchemaObjects) },
      { label: "Access path", value: String(metrics.accessObjects), width: width(metrics.accessObjects, maxAccessObjects) },
      { label: "Files", value: String(metrics.touchedFiles), width: width(metrics.touchedFiles, Math.max(metrics.touchedFiles, postgresTouchedFiles.length)) }
    ],
    schemaNodes: metrics.evidenceFiles.map((fileName, index) => ({
      name: basename(fileName),
      primary: index < 2
    })),
    events: events.map(([time, title, description, tag, active]) => ({ time, title, description, tag, active }))
  };
}

function scoreLanes(metrics) {
  const mongoWeight = weightedComplexity(metrics.mongo, metrics.postgres);
  const postgresWeight = weightedComplexity(metrics.postgres, metrics.postgres);

  return {
    mongo: Math.max(0, Math.round(100 - mongoWeight * 32)),
    postgres: Math.max(0, Math.round(100 - postgresWeight * 32))
  };
}

function weightedComplexity(lane, max) {
  return (
    (lane.contextTokens / max.contextTokens) * 0.42 +
    (lane.schemaObjects / max.schemaObjects) * 0.28 +
    (lane.accessObjects / max.accessObjects) * 0.24 +
    (lane.touchedFiles / max.touchedFiles) * 0.06
  );
}

function contextBytes(paths) {
  return paths.reduce((sum, filePath) => sum + Buffer.byteLength(readFileSync(filePath, "utf8"), "utf8"), 0);
}

function estimateTokens(bytes) {
  return Math.ceil(bytes / 4);
}

function width(value, max) {
  if (!max) return 0;
  return Math.max(8, Math.min(100, Math.round((value / max) * 100)));
}

function pct(delta, base) {
  return Math.round((delta / base) * 100);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
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

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readOptionalJson(filePath) {
  if (!existsSync(filePath)) return null;
  return readJson(filePath);
}

function matchingProof(proof, fixtureVersion) {
  if (!proof) return null;
  return proof.fixtureVersion === fixtureVersion ? proof : null;
}
