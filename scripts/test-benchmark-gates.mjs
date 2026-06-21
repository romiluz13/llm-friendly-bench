#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const resultPath = "benchmark/results/summary.json";
const bundlePath = "benchmark/public-bundle.json";
const result = JSON.parse(readFileSync(resultPath, "utf8"));
const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
mkdirSync(".tmp", { recursive: true });

try {
  assertGateRejects("public-v1-overclaim", () => {
    writeFileSync(resultPath, `${JSON.stringify({ ...result, status: "public-v1", claimLevel: "public-v1" }, null, 2)}\n`);
  });

  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);

  assertGateRejects("uncaveated-seed", () => {
    const mutant = structuredClone(bundle);
    mutant.currentSeed.caveat = "Final V1 benchmark result.";
    writeFileSync(bundlePath, `${JSON.stringify(mutant, null, 2)}\n`);
  });

  console.log("Negative AST-Bench gate tests passed");
} finally {
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
}

function assertGateRejects(name, mutate) {
  mutate();
  const result = spawnSync(process.execPath, ["scripts/benchmark-gates.mjs"], { encoding: "utf8" });
  if (result.status === 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`Negative benchmark gate test failed: ${name}`);
  }
}
