#!/usr/bin/env node

import { listTasks, readSuite, writeJson } from "./benchmark-lib.mjs";

const suite = readSuite();
const reviews = {
  schemaVersion: "1.0.0",
  suiteId: suite.suiteId,
  status: "rubric-pending-hitl",
  reviewer: "AST-Bench rubric; independent human review required before public-v1",
  generatedAt: new Date().toISOString(),
  rubric: [
    "MongoDB target must model around the product access pattern and keep related workflow state together when it is read together.",
    "Postgres target must use clean normalized boundaries, explicit relationship tables, and credible audit/approval tables.",
    "Neither target may hide required state outside the database-specific fixture.",
    "Schema-identical comparison is rejected because it would be less fair than database-native modeling.",
    "Public V1 requires this rubric to be reviewed by a human or named reviewer for every task."
  ],
  tasks: listTasks(suite).map((task) => ({
    taskId: task.id,
    title: task.title,
    domain: task.domainLabel,
    status: task.seedReplayId ? "captured-seed-review" : "rubric-pending-hitl",
    mongoRationale: `The MongoDB target for ${task.title} keeps the customer workflow request, risk signals, owner routing, customer message, and audit-facing state near the ${task.primaryEntity} access path so a coding agent can reason from the product aggregate outward.`,
    postgresRationale: `The Postgres target for ${task.title} keeps accounts, contracts, contacts, workflow requests, owner groups, risk signals, activities, owner tasks, customer messages, and audit events in clean normalized tables with explicit relationships.`,
    tradeoff: "The MongoDB lane favors product-state locality. The Postgres lane favors normalized integrity and explicit relationships. Both are credible, and neither should be flattened into the other.",
    strawmanDefense: "The task prompt and acceptance are identical; only the database-native modeling rule differs."
  }))
};

writeJson("benchmark/design-reviews/ast-bench-v1.json", reviews);
console.log("AST-Bench design review rubric emitted: benchmark/design-reviews/ast-bench-v1.json");
