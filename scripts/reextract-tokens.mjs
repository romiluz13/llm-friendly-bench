#!/usr/bin/env node
// Re-extract token metrics for already-captured run manifests using the current
// (corrected) extractUsage. Run after fixing agent-usage.mjs so historical runs
// reflect the right token accounting WITHOUT re-running any agent.
// Usage: node scripts/reextract-tokens.mjs [runsRoot]   (default: benchmark/runs-v2)

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractUsage } from "./agent-usage.mjs";
import { estimateTokensFromBytes } from "./benchmark-lib.mjs";

const root = process.argv[2] || "benchmark/runs-v2";
const manifests = [];
walk(root);

let changed = 0;
for (const path of manifests) {
  const m = JSON.parse(readFileSync(path, "utf8"));
  const transcriptPath = m.artifacts?.rawTranscript;
  if (!transcriptPath || !existsSync(transcriptPath)) {
    console.warn(`skip (no transcript): ${path}`);
    continue;
  }
  const text = readFileSync(transcriptPath, "utf8");
  const usage = extractUsage(m.agentId, text);
  const before = m.metrics.tokens?.tokensRead ?? null;
  m.metrics.tokens = usage;
  m.metrics.estimatedTranscriptTokens = usage.source === "measured"
    ? usage.totalTokens
    : estimateTokensFromBytes(m.metrics.transcriptBytes || 0);
  writeFileSync(path, `${JSON.stringify(m, null, 2)}\n`);
  changed += 1;
  console.log(`${m.shape}/${m.agentId}/${m.lane}/r${m.repeat}: tokensRead ${before} -> ${usage.tokensRead} (${usage.source})`);
}
console.log(`\nRe-extracted ${changed}/${manifests.length} manifests under ${root}.`);

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (entry === "run-manifest.json") manifests.push(p);
  }
}
