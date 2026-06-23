#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { readJson } from "./benchmark-lib.mjs";

const pagePath = "prototypes/lab-console/index.html";
const bundlePath = "prototypes/lab-console/evidence/ast-bench-v2/benchmark-public-bundle.json";
const errors = [];

requireCheck(existsSync(pagePath), `Missing public UI: ${pagePath}`);
requireCheck(existsSync(bundlePath), `Missing v2 public bundle: ${bundlePath}`);

if (existsSync(pagePath)) {
  const page = readFileSync(pagePath, "utf8");
  for (const id of [
    "app", "hero", "agreement-badge", "agent-graphs",
    "agent-graph-claude-code", "agent-graph-codex",
    "shape-story", "why-panel", "methodology", "evidence-drawer", "inspect-evidence", "claim-label"
  ]) {
    requireCheck(page.includes(`id="${id}"`), `Marketing UI missing surface: ${id}`);
  }
  for (const text of [
    "did measurably less database work on",
    "3 database designs × 2 AI assistants × 5 repeats = 60 real runs",
    "compare each AI assistant to itself",
    "Inspect the evidence"
  ]) {
    requireCheck(page.includes(text), `Marketing UI missing required copy: ${text}`);
  }
  for (const forbidden of [
    /Agent Schema Tax/i, /Proof mode/i, /MongoDB made the AI do less database work\./,
    /Customer Objections/i, /guaranteed savings/i, /\bmock\b/i, /seed replay/i
  ]) {
    requireCheck(!forbidden.test(page), `Marketing UI contains forbidden/internal copy: ${forbidden}`);
  }
  requireCheck(/fail-closed|Evidence unavailable/i.test(page), "Page must fail closed when the bundle is missing");
  requireCheck(/prefers-reduced-motion/.test(page), "Animated bars must respect prefers-reduced-motion");
  requireCheck(/function renderAgentGraphs/.test(page), "Page must render twin-agent graphs");
  requireCheck(/function renderShapeStory/.test(page), "Page must render the 3-shape depth story");
  requireCheck(/function renderWhyPanel/.test(page), "Page must render the auto-extracted why panel");
  requireCheck(/function renderEvidence/.test(page), "Page must render the evidence drawer");
  for (const button of page.matchAll(/<button\b[^>]*>/gi)) {
    requireCheck(/data-evidence=|data-action=|id="inspect-evidence"|id="copy-summary"/.test(button[0]), `Button lacks evidence/action binding: ${button[0]}`);
  }
}

if (existsSync(bundlePath)) {
  const bundle = readJson(bundlePath);
  requireCheck(bundle.status !== "public-v1", "v2 bundle must not overclaim public-v1");
  requireCheck(bundle.claimLabel === "3 database designs × 2 AI assistants × 5 repeats = 60 real runs", "Honest claim label required");
  requireCheck(!String(bundle.claimLabel).includes("450"), "450 must not appear in the customer claim label");
  requireCheck(JSON.stringify(bundle.methodology || {}).includes("450"), "450 full-V1 bar must be disclosed in methodology");
  requireCheck(bundle.progress?.requiredLaneRuns === 60, "v2 required lane runs must be 60");
  requireCheck(Array.isArray(bundle.shapeVerdict?.perShape) && bundle.shapeVerdict.perShape.length === 3, "Shape verdict must cover 3 shapes");
  requireCheck(Array.isArray(bundle.whyHighlights) && bundle.whyHighlights.length === 3, "Why panel must cover 3 shapes (available or fail-honest)");
  requireCheck(typeof bundle.shapeVerdict?.depthTrend?.growsWithDepth === "boolean", "Depth trend must be reported honestly as a boolean");
  requireCheck(Array.isArray(bundle.evidenceClaims) && bundle.evidenceClaims.length >= 6, "At least 6 evidence claims required");
  requireCheck(/within-agent/i.test(bundle.databaseVerdict?.caveat || ""), "Within-agent-only caveat must be present");
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
