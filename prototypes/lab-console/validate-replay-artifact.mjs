#!/usr/bin/env node

import { readFileSync } from "node:fs";

const file = process.argv[2] || "prototypes/lab-console/replays/order-exception-codex-v1-verified.json";
const artifact = JSON.parse(readFileSync(file, "utf8"));
const errors = [];

const required = [
  "schemaVersion",
  "artifactId",
  "proofStatus",
  "scenario",
  "task",
  "agent",
  "fairnessContract",
  "outcome",
  "verdict",
  "lanes",
  "scorecard",
  "costProjection",
  "proofPacket",
  "caseFile",
  "caveat"
];

const requireField = (condition, message) => {
  if (!condition) errors.push(message);
};

for (const key of required) {
  requireField(Object.hasOwn(artifact, key), `Missing top-level field: ${key}`);
}

requireField(["candidate", "verified", "incomplete"].includes(artifact.proofStatus), "Invalid proofStatus");
requireField(Array.isArray(artifact.lanes) && artifact.lanes.length === 2, "Artifact must compare exactly two lanes");
requireField(artifact.lanes?.some((lane) => lane.id === "mongo"), "Missing MongoDB lane");
requireField(artifact.lanes?.some((lane) => lane.id === "pg"), "Missing Postgres lane");

for (const lane of artifact.lanes || []) {
  requireField(Number.isInteger(lane.score) && lane.score >= 0 && lane.score <= 100, `${lane.name} score must be 0-100`);
  requireField(Array.isArray(lane.meters) && lane.meters.length > 0, `${lane.name} needs meters`);
  requireField(Array.isArray(lane.events) && lane.events.length > 0, `${lane.name} needs timeline events`);
  for (const meter of lane.meters || []) {
    requireField(Number.isInteger(meter.width) && meter.width >= 0 && meter.width <= 100, `${lane.name} meter ${meter.label} width must be 0-100`);
  }
}

const proofStatuses = new Set(["required", "captured", "verified", "incomplete"]);
const evidenceLedger = artifact.caseFile?.evidenceLedger || [];
const fairnessControls = artifact.caseFile?.fairnessControls || [];
const designReview = artifact.caseFile?.designReview;

requireField(fairnessControls.length > 0, "Fairness controls are required");
requireField(evidenceLedger.length > 0, "Evidence ledger is required");
requireField(Boolean(designReview), "Design review is required");

for (const item of fairnessControls) {
  requireField(item.label && item.value && item.status, "Every fairness control needs label, value, and status");
  requireField(proofStatuses.has(item.status), `Invalid fairness control status: ${item.status}`);
}

for (const item of evidenceLedger) {
  requireField(item.claim && item.source && item.status, "Every evidence item needs claim, source, and status");
  requireField(proofStatuses.has(item.status), `Invalid evidence status: ${item.status}`);
}

if (designReview) {
  requireField(proofStatuses.has(designReview.status), `Invalid design review status: ${designReview.status}`);
  requireField(designReview.mongoRationale && designReview.postgresRationale && designReview.tradeoff, "Design review needs both rationales and trade-off");
}

if (artifact.proofStatus === "verified") {
  const unverifiedStatuses = new Set(["required", "incomplete"]);
  const unverifiedEvidence = evidenceLedger.filter((item) => unverifiedStatuses.has(item.status));
  const unverifiedControls = fairnessControls.filter((item) => unverifiedStatuses.has(item.status));
  const unverifiedProofItems = (artifact.proofPacket?.items || []).filter((item) => unverifiedStatuses.has(item.value.toLowerCase()));
  const dataContract = artifact.dataContract;

  requireField(unverifiedEvidence.length === 0, "Verified artifacts cannot contain required or incomplete evidence");
  requireField(unverifiedControls.length === 0, "Verified artifacts cannot contain required or incomplete fairness controls");
  requireField(unverifiedProofItems.length === 0, "Verified artifacts cannot show required or incomplete Proof Packet items");
  requireField(["captured", "verified"].includes(designReview?.status), "Verified artifacts need captured or verified design review");
  requireField(Boolean(dataContract), "Verified artifacts need a runtime data contract");
  requireField(dataContract?.mockDataAllowed === false, "Verified artifacts must disable mocked runtime data");
  requireField(Array.isArray(dataContract?.runtimeSources) && dataContract.runtimeSources.length > 0, "Verified artifacts need runtime data sources");
  for (const source of dataContract?.runtimeSources || []) {
    requireField(source.label && source.detail && source.source && source.status, "Every runtime source needs label, detail, source, and status");
    requireField(["captured", "verified"].includes(source.status), `Invalid runtime source status: ${source.status}`);
  }
}

if (errors.length) {
  console.error(`Replay artifact validation failed for ${file}`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Replay artifact validation passed: ${artifact.artifactId} (${artifact.proofStatus})`);
