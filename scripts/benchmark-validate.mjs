#!/usr/bin/env node

import { existsSync } from "node:fs";
import { assert, expectedLaneRuns, listTasks, readSuite, suitePath, readSuiteFile, suitePathV2 } from "./benchmark-lib.mjs";

const suiteArg = process.argv.includes("--suite") ? process.argv[process.argv.indexOf("--suite") + 1] : "ast-bench-v1";
const errors = [];

if (suiteArg === "ast-bench-v2") {
  const suite = readSuiteFile(suitePathV2);

  assert(existsSync(suitePathV2), `Missing suite spec: ${suitePathV2}`, errors);
  assert(suite.suiteId === "ast-bench-v2", "Suite id must be ast-bench-v2", errors);
  assert(suite.claimStance === "benchmark-first", "Suite must use benchmark-first claim stance", errors);
  assert(suite.dataPolicy.includes("deterministic-synthetic"), "Suite must declare deterministic synthetic fixture policy", errors);
  assert(JSON.stringify(suite.shapes) === '["shallow","moderate","deep"]', "V2 shapes must be [shallow, moderate, deep]", errors);
  assert(suite.lanes.map((lane) => lane.id).join(",") === "mongo,postgres", "V2 lanes must be mongo and postgres", errors);
  assert(suite.agents.map((agent) => agent.id).join(",") === "claude-code,codex", "V2 agents must be Claude Code and Codex", errors);
  assert(suite.repeatsPerCell === 5, "V2 must require five repeats per agent/database/shape cell", errors);
  assert(suite.shapes.length * suite.lanes.length * suite.agents.length * suite.repeatsPerCell === suite.requiredLaneRuns,
    `requiredLaneRuns must equal ${suite.shapes.length * suite.lanes.length * suite.agents.length * suite.repeatsPerCell}`, errors);

  assert(Boolean(suite.outcome), "V2 must have an outcome", errors);
  if (suite.outcome) {
    assert(Boolean(suite.outcome.id), "Outcome must have id", errors);
    assert(Boolean(suite.outcome.title), "Outcome must have title", errors);
    assert(Boolean(suite.outcome.businessPrompt) && suite.outcome.businessPrompt.length > 80, "Outcome must have substantive business prompt", errors);
    assert(Boolean(suite.outcome.expectedOutcome), "Outcome must have expectedOutcome", errors);
    assert(["account", "order", "case", "invoice", "audit"].includes(suite.outcome.primaryEntity), "Outcome must have valid primaryEntity", errors);
  }

  assert(suite.fairnessRules.some((rule) => rule.includes("idiomatic") && rule.includes("Postgres")), "V2 must include idiomatic-Postgres fairness rule", errors);

  if (errors.length) {
    console.error("AST-Bench V2 suite validation failed");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`AST-Bench v2 suite validation passed: 3 shapes × 2 lanes × 2 agents × 5 repeats = 60 required lane runs`);
} else {
  const suite = readSuite();
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
}
