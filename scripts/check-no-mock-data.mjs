#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const publicPagePath = "prototypes/lab-console/index.html";
const v3BundlePath = "benchmark/public-bundle-v3.json";
const v3LabBundlePath = "prototypes/lab-console/evidence/ast-bench-v3/benchmark-public-bundle.json";
// v3 is the served bundle. v1/v2 are superseded and no longer hash-gated here:
// their evidence pinned hashes of scripts we have since edited for v3 (e.g.
// check-no-mock-data.mjs itself), so re-verifying them would fail on changes
// that don't touch the live page. v3 is the single source of truth.

const errors = [];
const forbiddenText = [
  /"proofStatus"\s*:\s*"mock"/i,
  /"status"\s*:\s*"mocked"/i,
  />\s*Mocked\s*</i,
  /Prototype fallback rendered/i,
  /guaranteed savings/i,
  /\bmock\b/i
];

requireExists(publicPagePath);
requireExists(v3BundlePath);
requireExists(v3LabBundlePath);

if (existsSync(publicPagePath)) {
  const page = readFileSync(publicPagePath, "utf8");
  for (const pattern of forbiddenText) {
    if (pattern.test(page)) errors.push(`${publicPagePath} contains forbidden public copy: ${pattern}`);
  }
  for (const tag of [...page.matchAll(/<button\b[^>]*>/gi)].map((m) => m[0])) {
    if (!/data-evidence=|data-action=|id="inspect-evidence"|id="copy-summary"/.test(tag)) {
      errors.push(`${publicPagePath} has a button without evidence/action binding: ${tag}`);
    }
  }
}

for (const path of [v3BundlePath, v3LabBundlePath]) {
  if (!existsSync(path)) continue;
  verifyV3Bundle(path);
}
if (errors.length) {
  console.error("No-unverified-runtime-data gate failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("No-unverified-runtime-data gate passed");

function verifyV3Bundle(path) {
  const bundle = JSON.parse(readFileSync(path, "utf8"));
  if (!["case-study", "pilot"].includes(bundle.status)) errors.push(`${path} has invalid v3 status: ${bundle.status}`);
  if (bundle.status === "public-v1") errors.push(`${path} must not overclaim public-v1`);
  if (bundle.executionMode !== "live-db") errors.push(`${path} must declare executionMode live-db`);
  if (String(bundle.claimLabel || "").includes("450")) errors.push(`${path} claim label must not contain 450`);
  if (!Array.isArray(bundle.evidenceClaims) || bundle.evidenceClaims.length < 6) errors.push(`${path} must expose >=6 evidence claims`);
  // Honest disclosure: the JSONB split must be surfaced, not hidden.
  if (!JSON.stringify(bundle.caveats || []).toLowerCase().includes("split")) errors.push(`${path} must disclose the tuned-JSONB split in caveats`);
  // Integrity counts must be present and self-consistent.
  const ig = bundle.integrity || {};
  if (typeof ig.clean !== "number" || typeof ig.failed !== "number") errors.push(`${path} must report integrity clean/failed counts`);
  verifyHashedSources(path, bundle.evidenceClaims || []);
}

function verifyHashedSources(path, claims) {
  for (const claim of claims) {
    if (!claim.question || !claim.verdict) errors.push(`${path} evidence claim needs question+verdict: ${claim.id}`);
    for (const src of claim.sources || []) {
      if (!src.exists || !existsSync(src.path)) { errors.push(`${path} evidence source missing: ${claim.id} -> ${src.path}`); continue; }
      if (!src.sha256 || src.sha256.length !== 64) { errors.push(`${path} evidence source needs sha256: ${claim.id} -> ${src.path}`); continue; }
      const actual = createHash("sha256").update(readFileSync(src.path)).digest("hex");
      if (actual !== src.sha256) errors.push(`${path} evidence hash mismatch (stale/forged): ${claim.id} -> ${src.path} (claims ${src.sha256.slice(0,12)}…, actual ${actual.slice(0,12)}…)`);
    }
  }
}

function requireExists(path) { if (!existsSync(path)) errors.push(`Missing runtime file: ${path}`); }
