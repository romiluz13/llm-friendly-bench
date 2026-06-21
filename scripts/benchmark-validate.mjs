#!/usr/bin/env node

import { existsSync } from "node:fs";
import { assert, expectedLaneRuns, listTasks, readSuite, suitePath } from "./benchmark-lib.mjs";

const suite = readSuite();
const errors = [];
const tasks = listTasks(suite);
const taskIds = new Set(tasks.map((task) => task.id));

assert(existsSync(suitePath), `Missing suite spec: ${suitePath}`, errors);
assert(suite.suiteId === "ast-bench-v1", "Suite id must be ast-bench-v1", errors);
assert(suite.claimStance === "benchmark-first", "Suite must use benchmark-first claim stance", errors);
assert(suite.dataPolicy.includes("deterministic-synthetic"), "Suite must declare deterministic synthetic fixture policy", errors);
assert(suite.domains.length === 5, "AST-Bench V1 must define five domains", errors);
assert(tasks.length === 25, "AST-Bench V1 must define 25 tasks", errors);
assert(taskIds.size === tasks.length, "Task ids must be unique", errors);
assert(suite.lanes.map((lane) => lane.id).join(",") === "mongo,postgres", "V1 lanes must be mongo and postgres", errors);
assert(suite.agents.map((agent) => agent.id).join(",") === "codex,claude-code,cursor", "V1 agents must be Codex, Claude Code, Cursor", errors);
assert(suite.repeatsPerCell === 3, "V1 must require three repeats per agent/database/task cell", errors);
assert(expectedLaneRuns(suite) === suite.requiredLaneRuns, `requiredLaneRuns must equal ${expectedLaneRuns(suite)}`, errors);

for (const tier of ["case-study", "pilot", "public-v1"]) {
  assert(suite.promotionTiers.some((item) => item.id === tier), `Missing promotion tier: ${tier}`, errors);
}

for (const task of tasks) {
  assert(Boolean(task.domainId), `Task ${task.id} needs domain id`, errors);
  assert(Boolean(task.title), `Task ${task.id} needs title`, errors);
  assert(Boolean(task.businessPrompt) && task.businessPrompt.length > 80, `Task ${task.id} needs a substantive business prompt`, errors);
  assert(Boolean(task.expectedOutcome), `Task ${task.id} needs expected outcome`, errors);
  assert(["account", "order", "case", "invoice", "audit"].includes(task.primaryEntity), `Task ${task.id} has invalid primaryEntity`, errors);
}

if (errors.length) {
  console.error("AST-Bench suite validation failed");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`AST-Bench suite validation passed: ${tasks.length} tasks, ${suite.requiredLaneRuns} required lane runs`);
