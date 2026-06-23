#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const publicPagePath = "prototypes/lab-console/index.html";
const v2BundlePath = "benchmark/public-bundle-v2.json";
const v2LabBundlePath = "prototypes/lab-console/evidence/ast-bench-v2/benchmark-public-bundle.json";
const v1BundlePath = "benchmark/public-bundle.json";
const v1LabBundlePath = "prototypes/lab-console/evidence/ast-bench-v1/benchmark-public-bundle.json";

const errors = [];
const forbiddenText = [
  /"proofStatus"\s*:\s*"mock"/i,
  /"status"\s*:\s*"mocked"/i,
  />\s*Mocked\s*</i,
  /Prototype fallback rendered/i,
  /guaranteed savings/i,
  /\bmock\b/i
];

// V2 runs execute against the database's data in its native file shape, NOT a
// live DB server (no pg/mongodb client in any run workspace). Forbid copy that
// claims a live/running database, so the 2026-06-24 "live local database"
// overclaim can never regress onto the public page or bundle.
const forbiddenClaim = [
  /live local database/i,
  /\blive database\b/i,
  /running (?:mongo|postgres|database)\b/i,
  /against a real (?:mongo|postgres|database) (?:server|instance)/i
];

requireExists(publicPagePath);
requireExists(v2BundlePath);
requireExists(v2LabBundlePath);

if (existsSync(publicPagePath)) {
  const page = readFileSync(publicPagePath, "utf8");
  for (const pattern of [...forbiddenText, ...forbiddenClaim]) {
    if (pattern.test(page)) errors.push(`${publicPagePath} contains forbidden public copy: ${pattern}`);
  }
  for (const tag of [...page.matchAll(/<button\b[^>]*>/gi)].map((m) => m[0])) {
    if (!/data-evidence=|data-action=|id="inspect-evidence"|id="copy-summary"/.test(tag)) {
      errors.push(`${publicPagePath} has a button without evidence/action binding: ${tag}`);
    }
  }
}

for (const path of [v2BundlePath, v2LabBundlePath]) {
  if (!existsSync(path)) continue;
  verifyV2Bundle(path);
}
for (const path of [v1BundlePath, v1LabBundlePath]) {
  if (!existsSync(path)) continue;
  verifyHashedSources(path, JSON.parse(readFileSync(path, "utf8")).evidenceClaims || []);
}

if (errors.length) {
  console.error("No-unverified-runtime-data gate failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("No-unverified-runtime-data gate passed");

function verifyV2Bundle(path) {
  const raw = readFileSync(path, "utf8");
  for (const pattern of forbiddenClaim) {
    if (pattern.test(raw)) errors.push(`${path} contains forbidden live-database claim: ${pattern}`);
  }
  const bundle = JSON.parse(raw);
  if (!["case-study", "pilot"].includes(bundle.status)) errors.push(`${path} has invalid v2 status: ${bundle.status}`);
  if (bundle.status === "public-v1") errors.push(`${path} must not overclaim public-v1`);
  if (String(bundle.claimLabel || "").includes("450")) errors.push(`${path} claim label must not contain 450`);
  if (!JSON.stringify(bundle.methodology || {}).includes("450")) errors.push(`${path} must disclose the 450 full-V1 bar in methodology`);
  if (!Array.isArray(bundle.evidenceClaims) || bundle.evidenceClaims.length < 6) errors.push(`${path} must expose >=6 evidence claims`);
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
