#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const verifiedPath = "prototypes/lab-console/replays/order-exception-codex-v1-verified.json";
const seedEvidenceBundlePath = "prototypes/lab-console/evidence/order-exception-codex-v1/evidence-bundle.json";
const benchmarkBundlePath = "benchmark/public-bundle.json";
const labBenchmarkBundlePath = "prototypes/lab-console/evidence/ast-bench-v1/benchmark-public-bundle.json";
const publicPagePath = "prototypes/lab-console/index.html";
const retiredPrototypePath = "prototypes/lab-console/replays/order-exception-codex-v0.json";
const runtimeFiles = [
  publicPagePath,
  verifiedPath,
  seedEvidenceBundlePath,
  benchmarkBundlePath,
  labBenchmarkBundlePath,
  "data/generated/proof/verified-evidence-manifest.json",
  "instrumented-agent-runs/order-exception-codex-v1/summary.json"
];
const forbiddenText = [
  /"proofStatus"\s*:\s*"mock"/i,
  /"status"\s*:\s*"mocked"/i,
  />\s*Mocked\s*</i,
  /Mock proof shape/i,
  /Prototype fallback rendered/i,
  /Customer Objections/i,
  />\s*Objection\s*</i,
  /customer-sendable/i
];
const requiredPublicPageText = [
  /AST-Bench/i,
  /Agent Schema Tax Benchmark/i,
  /MongoDB made the AI do less database work\./i,
  /Verified AI coding run/i,
  /Inspect proof/i,
  /Play replay/i,
  /Proof mode/i,
  /Cost receipt/i
];
const requiredPublicIds = [
  "app",
  "status-pill",
  "progress-meter",
  "seed-receipt",
  "seed-answer",
  "lane-board",
  "replay-stage",
  "command-stream",
  "evidence-drawer",
  "cost-controls",
  "claim-buttons"
];
const errors = [];

if (existsSync(retiredPrototypePath)) {
  errors.push(`Retired prototype replay must not ship in the runnable console: ${retiredPrototypePath}`);
}

for (const file of runtimeFiles) {
  if (!existsSync(file)) {
    errors.push(`Missing runtime file: ${file}`);
    continue;
  }
  const text = readFileSync(file, "utf8");
  for (const pattern of forbiddenText) {
    if (pattern.test(text)) errors.push(`${file} contains forbidden public proof text: ${pattern}`);
  }
}

if (existsSync(publicPagePath)) {
  const page = readFileSync(publicPagePath, "utf8");
  for (const pattern of requiredPublicPageText) {
    if (!pattern.test(page)) errors.push(`${publicPagePath} is missing required benchmark proof copy: ${pattern}`);
  }
  if (/guaranteed savings/i.test(page)) {
    errors.push(`${publicPagePath} must not frame projection as guaranteed savings`);
  }
  for (const id of requiredPublicIds) {
    if (!page.includes(`id="${id}"`)) errors.push(`${publicPagePath} is missing public interaction surface: ${id}`);
  }
  const buttonTags = [...page.matchAll(/<button\b[^>]*>/gi)].map((match) => match[0]);
  for (const tag of buttonTags) {
    if (!/data-claim=|id="play-replay"|id="copy-summary"/.test(tag)) {
      errors.push(`${publicPagePath} has a button without evidence/action binding: ${tag}`);
    }
  }
}

if (existsSync(verifiedPath)) {
  const artifact = JSON.parse(readFileSync(verifiedPath, "utf8"));
  if (artifact.proofStatus !== "verified") errors.push("Seed replay must remain verified evidence");
  if (artifact.dataContract?.mockDataAllowed !== false) errors.push("Verified replay must disable unverified runtime data");
  for (const source of artifact.dataContract?.runtimeSources || []) {
    if (!["captured", "verified"].includes(source.status)) errors.push(`Runtime source is not captured or verified: ${source.label}`);
    if (source.source && !existsSync(source.source)) errors.push(`Runtime source file does not exist: ${source.source}`);
  }
}

if (existsSync(seedEvidenceBundlePath)) {
  const bundle = JSON.parse(readFileSync(seedEvidenceBundlePath, "utf8"));
  if (bundle.status !== "verified") errors.push("Seed evidence bundle must remain verified");
  if (!bundle.publicPacket?.title || !Array.isArray(bundle.publicPacket?.proofRules)) {
    errors.push("Seed evidence bundle must expose a public proof packet");
  }
}

for (const path of [benchmarkBundlePath, labBenchmarkBundlePath]) {
  if (!existsSync(path)) continue;
  const bundle = JSON.parse(readFileSync(path, "utf8"));
  if (!["case-study", "pilot", "public-v1"].includes(bundle.status)) errors.push(`${path} has invalid benchmark status`);
  if (bundle.status === "public-v1" && bundle.progress?.passedLaneRuns < bundle.progress?.requiredLaneRuns) {
    errors.push(`${path} overclaims public-v1 before required lane runs exist`);
  }
  if (!bundle.currentSeed?.caveat?.includes("not the V1 benchmark result")) {
    errors.push(`${path} must visibly caveat seed evidence`);
  }
  if (!Array.isArray(bundle.evidenceClaims) || bundle.evidenceClaims.length < 6) {
    errors.push(`${path} must expose benchmark evidence claims`);
  }
  for (const claim of bundle.evidenceClaims || []) {
    if (!claim.question || !claim.verdict) errors.push(`${path} evidence claim needs question and verdict: ${claim.id}`);
    for (const source of claim.sources || []) {
      if (!source.exists || !existsSync(source.path)) errors.push(`${path} evidence source does not exist: ${claim.id} -> ${source.path}`);
      if (!source.sha256 || source.sha256.length !== 64) errors.push(`${path} evidence source needs sha256: ${claim.id} -> ${source.path}`);
      if (source.sha256 && source.sha256.length === 64 && existsSync(source.path)) {
        const actual = createHash("sha256").update(readFileSync(source.path)).digest("hex");
        if (actual !== source.sha256) errors.push(`${path} evidence source hash mismatch (stale/forged): ${claim.id} -> ${source.path} (claims ${source.sha256.slice(0, 12)}…, actual ${actual.slice(0, 12)}…)`);
      }
    }
  }
}

if (errors.length) {
  console.error("No-unverified-runtime-data gate failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("No-unverified-runtime-data gate passed");
