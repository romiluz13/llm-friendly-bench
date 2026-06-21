#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { publicBundlePath, readJson } from "./benchmark-lib.mjs";

const pagePath = "prototypes/lab-console/index.html";
const errors = [];

requireCheck(existsSync(pagePath), `Missing public UI: ${pagePath}`);
requireCheck(existsSync(publicBundlePath), `Missing public bundle: ${publicBundlePath}`);

if (existsSync(pagePath)) {
  const page = readFileSync(pagePath, "utf8");
  for (const id of [
    "app",
    "status-pill",
    "progress-meter",
    "seed-receipt",
    "seed-answer",
    "lane-board",
    "replay-stage",
    "run-context",
    "command-stream",
    "evidence-drawer",
    "cost-controls",
    "claim-buttons",
    "action-receipt",
    "action-title",
    "action-badge"
  ]) {
    requireCheck(page.includes(`id="${id}"`), `Public UI missing interaction surface: ${id}`);
  }
  for (const text of ["AST-Bench", "Agent Schema Tax Benchmark", "Verified AI coding run", "Inspect proof", "Play replay", "Ready for the customer demo", "MongoDB made the AI do less database work.", "Proof mode"]) {
    requireCheck(page.includes(text), `Public UI missing required copy: ${text}`);
  }
  for (const forbidden of [/Customer Objections/i, /guaranteed savings/i, /mock/i]) {
    requireCheck(!forbidden.test(page), `Public UI contains forbidden copy: ${forbidden}`);
  }
  for (const button of page.matchAll(/<button\b[^>]*>/gi)) {
    requireCheck(/data-claim=|id="play-replay"|id="copy-summary"/.test(button[0]), `Button lacks evidence/action binding: ${button[0]}`);
  }
  requireCheck(/function activateClaim/.test(page), "Public UI must route clicks through explicit evidence activation");
  requireCheck(/function renderActiveStates/.test(page), "Public UI must render active evidence states");
  requireCheck(!/querySelectorAll\("\[data-claim\]"\)/.test(page), "Shared evidence claims must not drive visual active state");
  requireCheck(/data-proof=/.test(page), "Proof drawer tabs need their own active-state key");
  requireCheck(/\.lane-card\[data-lane\]/.test(page), "Lane active state must be scoped to lane cards");
  requireCheck(/activeControl/.test(page), "Public UI must separate clicked focus from persistent context state");
  requireCheck(/function controlFromTrigger/.test(page), "Public UI must derive focus from the clicked control");
  requireCheck(/activeControl\.type === "file"/.test(page), "File ledger rows must not stay active unless the file itself was clicked");
  requireCheck(/\.replay-stage\s*\{[\s\S]*grid-template-columns:\s*1fr;/.test(page), "Replay stage must not squeeze the visual canvas beside the evidence feed");
  requireCheck(!/button\[aria-pressed="true"\]/.test(page), "Pressed-state styling must not globally paint unrelated buttons");
  requireCheck(/function renderActionReceipt/.test(page), "Public UI must show action receipt feedback");
  requireCheck(/function renderLaneBoard/.test(page), "Public UI must render direct lane comparison");
  requireCheck(/function selectedTask/.test(page), "Public UI must expose selected task context");
  requireCheck(/function selectedAgent/.test(page), "Public UI must expose selected agent context");
}

if (existsSync(publicBundlePath)) {
  const bundle = readJson(publicBundlePath);
  requireCheck(bundle.status !== "public-v1", "Current bundle must not overclaim public-v1 before 450 lane runs");
  requireCheck(bundle.progress.requiredLaneRuns === 450, "Bundle must preserve 450-run V1 bar");
  requireCheck(bundle.currentSeed.caveat.includes("not the V1 benchmark result"), "Seed must be visibly caveated");
  requireCheck(bundle.currentSeed.comparison?.lanes?.length === 2, "Seed comparison must expose both database lanes");
  requireCheck(bundle.currentSeed.comparison?.deltas?.length >= 4, "Seed comparison must expose the visible deltas");
}

if (errors.length) {
  console.error("AST-Bench UI test failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("AST-Bench UI test passed");

function requireCheck(condition, message) {
  if (!condition) errors.push(message);
}
