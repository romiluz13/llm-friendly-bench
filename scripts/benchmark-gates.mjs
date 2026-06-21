#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import {
  assert,
  publicBundlePath,
  readJson,
  readRunManifests,
  readSuite,
  resultPath
} from "./benchmark-lib.mjs";

const suite = readSuite();
const errors = [];
const runManifests = readRunManifests(suite);

assert(existsSync(resultPath), `Missing benchmark summary: ${resultPath}`, errors);
assert(existsSync(publicBundlePath), `Missing public benchmark bundle: ${publicBundlePath}`, errors);

if (existsSync(resultPath)) {
  const result = readJson(resultPath);
  assert(["case-study", "pilot", "public-v1"].includes(result.status), "Invalid benchmark status", errors);
  assert(result.requiredLaneRuns === suite.requiredLaneRuns, "Benchmark summary must preserve required lane run count", errors);
  assert(result.capturedLaneRuns <= result.requiredLaneRuns, "Captured lane runs cannot exceed required lane runs", errors);
  if (result.status === "public-v1") {
    assert(result.passedLaneRuns >= suite.requiredLaneRuns, "public-v1 requires every lane run to pass", errors);
    assert(result.missingLaneRuns === 0, "public-v1 cannot have missing lane runs", errors);
  }
  if (result.passedLaneRuns < suite.requiredLaneRuns) {
    assert(result.status !== "public-v1", "Cannot label incomplete evidence as public-v1", errors);
  }
}

for (const run of runManifests) {
  for (const key of ["prompt", "rawTranscript", "stderr", "diff", "tests", "dbBefore"]) {
    const path = run.artifacts?.[key];
    assert(Boolean(path) && existsSync(path), `Run artifact missing ${key}: ${run.taskId}/${run.agentId}/${run.lane}/repeat-${run.repeat}`, errors);
  }
  if (run.status === "passed") {
    assert(run.metrics?.testStatus === "passed", `Passed run must have passed tests: ${run.taskId}/${run.agentId}/${run.lane}/repeat-${run.repeat}`, errors);
    assert(existsSync(run.artifacts?.acceptance || ""), `Passed run needs acceptance evidence: ${run.taskId}/${run.agentId}/${run.lane}/repeat-${run.repeat}`, errors);
    assert(existsSync(run.artifacts?.screenshot || ""), `Passed run needs rendered state evidence: ${run.taskId}/${run.agentId}/${run.lane}/repeat-${run.repeat}`, errors);
    for (const file of run.metrics?.changedFiles || []) {
      assert(!file.startsWith("tests/"), `Passed run changed tests: ${run.taskId}/${run.agentId}/${run.lane}/repeat-${run.repeat} -> ${file}`, errors);
      assert(!file.startsWith("data/"), `Passed run changed fixture data: ${run.taskId}/${run.agentId}/${run.lane}/repeat-${run.repeat} -> ${file}`, errors);
    }
  }
}

if (existsSync(publicBundlePath)) {
  const bundle = readJson(publicBundlePath);
  assert(bundle.status !== "public-v1" || bundle.progress?.passedLaneRuns >= suite.requiredLaneRuns, "Public bundle overclaims public-v1", errors);
  assert(bundle.currentSeed?.caveat?.includes("not the V1 benchmark result"), "Seed evidence must be caveated as not V1", errors);
  assert(Array.isArray(bundle.evidenceClaims) && bundle.evidenceClaims.length >= 6, "Public bundle needs evidence claims", errors);
  for (const claim of bundle.evidenceClaims || []) {
    assert(claim.question && claim.verdict, `Evidence claim needs question and verdict: ${claim.id}`, errors);
    assert(Array.isArray(claim.sources) && claim.sources.length > 0, `Evidence claim needs sources: ${claim.id}`, errors);
    for (const source of claim.sources) {
      assert(source.exists === true, `Evidence source does not exist: ${claim.id} -> ${source.path}`, errors);
      assert(source.sha256 && source.sha256.length === 64, `Evidence source needs sha256: ${claim.id} -> ${source.path}`, errors);
    }
  }
}

const publicPagePath = "prototypes/lab-console/index.html";
if (existsSync(publicPagePath)) {
  const page = readFileSync(publicPagePath, "utf8");
  for (const forbidden of [/Customer Objections/i, /guaranteed savings/i, /mock data/i, /mocked/i, /customer-sendable/i]) {
    assert(!forbidden.test(page), `Public page contains forbidden public-proof copy: ${forbidden}`, errors);
  }
}

if (errors.length) {
  console.error("AST-Bench gates failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("AST-Bench gates passed");
