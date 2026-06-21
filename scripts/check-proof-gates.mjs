#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const artifactPath = process.argv[2] || "prototypes/lab-console/replays/order-exception-codex-v1-candidate.json";
const artifact = readJson(artifactPath);
const errors = [];

const evidenceLedger = artifact.caseFile?.evidenceLedger || [];
const fairnessControls = artifact.caseFile?.fairnessControls || [];
const proofItems = artifact.proofPacket?.items || [];
const manifestPath = findLedgerSource("Evidence manifest") || "data/generated/proof/evidence-manifest.json";

requireGate(existsSync(manifestPath), `Missing evidence manifest: ${manifestPath}`);

if (existsSync(manifestPath)) {
  const manifest = readJson(manifestPath);
  requireGate(manifest.artifactId === artifact.artifactId, "Evidence manifest artifactId must match replay artifact");
  requireGate(Array.isArray(manifest.files) && manifest.files.length > 0, "Evidence manifest needs hashed files");

  for (const file of manifest.files || []) {
    requireGate(existsSync(file.path), `Missing manifest file: ${file.path}`);
    if (existsSync(file.path)) {
      const actualHash = sha256(file.path);
      requireGate(actualHash === file.sha256, `Hash mismatch for ${file.path}`);
    }
  }
}

for (const item of evidenceLedger) {
  if (["captured", "verified"].includes(item.status)) {
    for (const source of concreteSources(item.source)) {
      requireGate(existsSync(source), `Captured evidence source does not exist: ${source}`);
    }
  }
}

const acceptancePath = findJsonLedgerSource("acceptance") || "data/generated/proof/order-exception-acceptance.json";
if (existsSync(acceptancePath)) {
  const acceptance = readJson(acceptancePath);
  requireGate(acceptance.status === "passed", "Acceptance evidence must be passed");
} else {
  requireGate(false, `Missing acceptance evidence: ${acceptancePath}`);
}

if (artifact.proofStatus === "candidate") {
  const invalidItems = proofItems.filter((item) => item.value.toLowerCase() === "mocked");
  requireGate(invalidItems.length === 0, "Candidate artifacts cannot contain mocked Proof Packet items");
}

if (artifact.proofStatus === "verified") {
  const unverifiedStatuses = new Set(["required", "incomplete"]);
  const unverifiedEvidence = evidenceLedger.filter((item) => unverifiedStatuses.has(item.status));
  const unverifiedControls = fairnessControls.filter((item) => unverifiedStatuses.has(item.status));
  const unverifiedProofItems = proofItems.filter((item) => unverifiedStatuses.has(item.value.toLowerCase()));
  const dataContract = artifact.dataContract;

  requireGate(unverifiedEvidence.length === 0, "Verified artifacts cannot contain unverified evidence");
  requireGate(unverifiedControls.length === 0, "Verified artifacts cannot contain unverified fairness controls");
  requireGate(unverifiedProofItems.length === 0, "Verified artifacts cannot contain unverified Proof Packet items");
  requireGate(["captured", "verified"].includes(artifact.caseFile?.designReview?.status), "Verified artifacts need captured or verified design review");
  requireGate(Boolean(findLedgerSource("Captured Codex trace")), "Verified artifacts need captured Codex trace evidence");
  requireGate(Boolean(dataContract), "Verified artifacts need a runtime data contract");
  requireGate(dataContract?.mockDataAllowed === false, "Verified artifacts must disable mocked runtime data");
  requireGate(Array.isArray(dataContract?.runtimeSources) && dataContract.runtimeSources.length > 0, "Verified artifacts need runtime data sources");
  for (const source of dataContract?.runtimeSources || []) {
    requireGate(["captured", "verified"].includes(source.status), `Runtime source must be captured or verified: ${source.label}`);
    for (const concreteSource of concreteSources(source.source)) {
      requireGate(existsSync(concreteSource), `Runtime source does not exist: ${concreteSource}`);
    }
  }
}

if (errors.length) {
  console.error(`Proof gates failed for ${artifactPath}`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Proof gates passed: ${artifact.artifactId} (${artifact.proofStatus})`);

function requireGate(condition, message) {
  if (!condition) errors.push(message);
}

function findLedgerSource(needle) {
  const item = evidenceLedger.find((entry) => entry.claim.toLowerCase().includes(needle.toLowerCase()));
  return item?.source;
}

function findJsonLedgerSource(needle) {
  const item = evidenceLedger.find((entry) =>
    entry.claim.toLowerCase().includes(needle.toLowerCase()) &&
    entry.source.endsWith(".json")
  );
  return item?.source;
}

function concreteSources(source) {
  return String(source)
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !value.includes("*"))
    .filter((value) => !value.endsWith("/"));
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}
