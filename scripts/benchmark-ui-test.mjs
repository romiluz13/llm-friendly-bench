#!/usr/bin/env node

// Enterprise benchmark UI test — verifies the marketing page renders
// the enterprise results, proof-of-no-bias, and technical details.
// No hypotheses are tested — the benchmark presents raw data only.

import { existsSync, readFileSync } from "node:fs";

const pagePath = "prototypes/lab-console/index.html";
const bundlePath = "prototypes/lab-console/evidence/enterprise/enterprise-bundle.json";
const errors = [];

function requireCheck(condition, message) {
  if (!condition) errors.push(message);
}

requireCheck(existsSync(pagePath), `Missing public UI: ${pagePath}`);
requireCheck(existsSync(bundlePath), `Missing enterprise bundle: ${bundlePath}`);

if (existsSync(pagePath)) {
  const page = readFileSync(pagePath, "utf8");

  // Required surfaces (enterprise UI — no hypotheses section)
  for (const id of [
    "results", "proof", "how", "cost", "schema", "task",
    "agent-results", "proof-grid", "pipeline", "cost-cards", "schema-viz",
  ]) {
    requireCheck(page.includes(`id="${id}"`), `Enterprise UI missing surface: ${id}`);
  }

  // Required copy — enterprise framing, no claims
  for (const text of [
    "MongoDB",
    "Postgres",
    "40-entity",
    "Zero Bias",
    "live database",
    "vanilla",
    "anti-cheat",
    "within-agent",
  ]) {
    requireCheck(page.includes(text), `Enterprise UI missing required copy: ${text}`);
  }

  // No hypotheses, no verdicts, no claims — just raw data
  requireCheck(!page.includes("CONFIRMED"), "Page must not contain hypothesis verdicts");
  requireCheck(!page.includes("REFUTED"), "Page must not contain hypothesis verdicts");
  requireCheck(!page.includes("Pre-Registered"), "Page must not claim pre-registered hypotheses");
  requireCheck(!page.includes("renderHypotheses"), "Page must not have hypothesis rendering code");

  // Forbidden copy — no internal names, no overclaims
  for (const forbidden of [
    /Agent Schema Tax/i, /Proof mode/i, /guaranteed savings/i,
    /\bmock\b/i, /seed replay/i, /live local database/i,
  ]) {
    requireCheck(!forbidden.test(page), `Enterprise UI contains forbidden/internal copy: ${forbidden}`);
  }

  // Fail-closed behavior
  requireCheck(/fail-closed|Evidence unavailable/i.test(page), "Page must fail closed when the bundle is missing");

  // Accessibility
  requireCheck(/prefers-reduced-motion/.test(page), "Animated bars must respect prefers-reduced-motion");

  // Required render functions (no renderHypotheses)
  requireCheck(/function renderResults/.test(page), "Page must render the agent results");
  requireCheck(/function renderProof/.test(page), "Page must render the zero-bias proof grid");
  requireCheck(/function renderPipeline/.test(page), "Page must render the pipeline steps");
  requireCheck(/function renderCost/.test(page), "Page must render the cost projection");
  requireCheck(/function renderSchema/.test(page), "Page must render the schema visualization");
}

if (existsSync(bundlePath)) {
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));

  // Bundle structure
  requireCheck(bundle.schemaVersion === "1.0.0", "Bundle must declare schemaVersion 1.0.0");
  requireCheck(bundle.executionMode === "live-db", "Bundle must declare live-db execution mode");
  requireCheck(Array.isArray(bundle.agents) && bundle.agents.length === 2, "Two agents required");
  requireCheck(Array.isArray(bundle.proofOfNoBias) && bundle.proofOfNoBias.length >= 8, "At least 8 no-bias defenses required");

  // Each agent has all 3 lanes with clean repeats
  for (const a of bundle.agents) {
    requireCheck(a.lanes && a.lanes.mongo && a.lanes["postgres-norm"] && a.lanes["postgres-jsonb"],
      `Agent ${a.agentId} must report all 3 lanes`);
    for (const lane of ["mongo", "postgres-norm", "postgres-jsonb"]) {
      requireCheck(a.lanes[lane].cleanRepeats === 5, `Agent ${a.agentId} lane ${lane} must have 5/5 clean`);
      requireCheck(typeof a.lanes[lane].medianTokensRead === "number", `Agent ${a.agentId} lane ${lane} needs medianTokensRead`);
    }
  }

  // No hypotheses in the bundle
  requireCheck(!bundle.hypotheses, "Bundle must NOT contain hypotheses — raw data only");

  // Within-agent caveat
  requireCheck(/within-agent/i.test(bundle.caveat || ""), "Within-agent-only caveat must be present");

  // DB versions
  requireCheck(bundle.dbVersions && bundle.dbVersions.mongo && bundle.dbVersions.postgres, "DB versions must be declared");

  // Schema scale
  requireCheck(bundle.schemaScale && bundle.schemaScale.entities === 40, "Schema must have 40 entities");
}

if (errors.length) {
  console.error("Enterprise benchmark UI test failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Enterprise benchmark UI test passed");
