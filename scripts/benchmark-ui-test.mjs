#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { readJson } from "./benchmark-lib.mjs";

const pagePath = "prototypes/lab-console/index.html";
const bundlePath = "prototypes/lab-console/evidence/ast-bench-v3/benchmark-public-bundle.json";
const errors = [];

requireCheck(existsSync(pagePath), `Missing public UI: ${pagePath}`);
requireCheck(existsSync(bundlePath), `Missing v3 public bundle: ${bundlePath}`);

if (existsSync(pagePath)) {
  const page = readFileSync(pagePath, "utf8");
  for (const id of [
    "app", "hero", "agreement-badge", "agent-graphs",
    "agent-graph-claude-code", "agent-graph-codex",
    "cost-panel", "shape-story", "methodology", "evidence-drawer", "inspect-evidence", "claim-label"
  ]) {
    requireCheck(page.includes(`id="${id}"`), `Marketing UI missing surface: ${id}`);
  }
  for (const text of [
    "data shape",                       // shape-wins framing
    "3 database designs × 2 AI assistants × 5 repeats = 90 live-database runs",
    "compared only to itself",          // within-agent rule in plain words
    "Inspect the evidence"
  ]) {
    requireCheck(page.includes(text), `Marketing UI missing required copy: ${text}`);
  }
  for (const forbidden of [
    /Agent Schema Tax/i, /Proof mode/i, /Customer Objections/i,
    /guaranteed savings/i, /\bmock\b/i, /seed replay/i,
    /live local database/i               // the corrected overclaim must never return
  ]) {
    requireCheck(!forbidden.test(page), `Marketing UI contains forbidden/internal copy: ${forbidden}`);
  }
  requireCheck(/fail-closed|Evidence unavailable/i.test(page), "Page must fail closed when the bundle is missing");
  requireCheck(/prefers-reduced-motion/.test(page), "Animated bars must respect prefers-reduced-motion");
  requireCheck(/function renderGraphs/.test(page), "Page must render the 3-lane agent graphs");
  requireCheck(/function renderCost/.test(page), "Page must render the scaled cost projection");
  requireCheck(/function renderShapes/.test(page), "Page must render the per-shape story");
  requireCheck(/function renderEvidence/.test(page), "Page must render the evidence drawer");
  for (const button of page.matchAll(/<button\b[^>]*>/gi)) {
    requireCheck(/data-evidence=|data-action=|id="inspect-evidence"|id="copy-summary"/.test(button[0]), `Button lacks evidence/action binding: ${button[0]}`);
  }
}

if (existsSync(bundlePath)) {
  const bundle = readJson(bundlePath);
  requireCheck(bundle.status !== "public-v1", "v3 bundle must not overclaim public-v1");
  requireCheck(bundle.executionMode === "live-db", "v3 must declare live-db execution mode");
  requireCheck(bundle.claimLabel === "3 database designs × 2 AI assistants × 5 repeats = 90 live-database runs", "Honest v3 claim label required");
  requireCheck(!String(bundle.claimLabel).includes("450"), "450 must not appear in the customer claim label");
  requireCheck(Array.isArray(bundle.agents) && bundle.agents.length === 2, "Two agents required");
  requireCheck(bundle.agents.every((a) => a.lanes && a.lanes.mongo && a.lanes["postgres-norm"] && a.lanes["postgres-jsonb"]), "Each agent must report all 3 lanes");
  requireCheck(bundle.agents.every((a) => Array.isArray(a.perShape) && a.perShape.length === 3), "Each agent must report 3 shapes");
  requireCheck(bundle.integrity && typeof bundle.integrity.clean === "number" && typeof bundle.integrity.failed === "number", "Integrity counts (clean/failed) required");
  requireCheck(Array.isArray(bundle.evidenceClaims) && bundle.evidenceClaims.length >= 6, "At least 6 evidence claims required");
  requireCheck(/within-agent/i.test(JSON.stringify(bundle.methodology || {}) + (bundle.caveat || "")), "Within-agent-only rule must be present");
  // Honest disclosure: the JSONB split must be visible somewhere in caveats.
  requireCheck(JSON.stringify(bundle.caveats || []).toLowerCase().includes("split"), "JSONB split must be disclosed in caveats");
}

if (errors.length) {
  console.error("AST-Bench marketing UI test failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("AST-Bench marketing UI test passed");

function requireCheck(condition, message) {
  if (!condition) errors.push(message);
}
