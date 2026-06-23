#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import {
  benchmarkTaskPrompt,
  buildTaskFixture,
  listTasks,
  readSuite,
  readSuiteFile,
  targetWorkspacePath,
  targetWorkspacePathV2,
  suitePathV2,
  writeJson,
  writeText
} from "./benchmark-lib.mjs";
import { SHAPES } from "./benchmark-shapes.mjs";

const suiteArg = valueAfter("--suite") || "ast-bench-v1";
const shapeArg = valueAfter("--shape");
const laneArg = valueAfter("--lane");
const args = new Set(process.argv.slice(2));

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : "";
}

if (suiteArg === "ast-bench-v2") {
  const suiteV2 = readSuiteFile(suitePathV2);
  const task = suiteV2.outcome;
  const shapes = SHAPES.filter((s) => !shapeArg || s === shapeArg);
  const lanesV2 = suiteV2.lanes.filter((lane) => !laneArg || lane.id === laneArg);

  for (const shape of shapes) {
    for (const lane of lanesV2) {
      const workspace = targetWorkspacePathV2(shape, lane.id);
      rmSync(workspace, { recursive: true, force: true });
      writeWorkspace({ suite: suiteV2, task, lane: lane.id, shape, workspace });
      console.log(`Prepared AST-Bench v2 target: ${shape}/${lane.id}`);
    }
  }
} else {
  const suite = readSuite();
  const taskArg = valueAfter("--task");
  const tasks = listTasks(suite).filter((task) => !taskArg || task.id === taskArg);
  const lanes = suite.lanes.filter((lane) => !laneArg || lane.id === laneArg);

  if (!tasks.length) throw new Error(`Unknown task selector: ${taskArg}`);
  if (!lanes.length) throw new Error(`Unknown lane selector: ${laneArg}`);

  for (const task of tasks) {
    for (const lane of lanes) {
      const workspace = targetWorkspacePath(task.id, lane.id);
      rmSync(workspace, { recursive: true, force: true });
      writeWorkspace({ suite, task, lane: lane.id, workspace });
      console.log(`Prepared AST-Bench target: ${task.id}/${lane.id}`);
    }
  }
}

function writeWorkspace({ suite, task, lane, shape, workspace }) {
  const data = buildTaskFixture(task, lane, shape);
  const dataFile = lane === "mongo" ? "collections.json" : "tables.json";
  writeJson(join(workspace, "package.json"), {
    name: `ast-bench-${task.id}-${lane}`,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      test: "node tests/acceptance.test.mjs",
      render: "node src/render-proof.mjs"
    }
  });
  writeText(join(workspace, "README.md"), readme({ suite, task, lane }));
  writeText(join(workspace, "AGENTS.md"), agents({ task, lane }));
  writeText(join(workspace, "schema", "schema.md"), schemaDoc({ task, lane, data }));
  writeText(join(workspace, "schema", "access-paths.md"), accessPathDoc({ task, lane, data }));
  writeText(join(workspace, "migrations", lane === "mongo" ? "001_collection_contract.mongodb.js" : "001_table_contract.sql"), migrationDoc({ task, lane, data }));
  writeJson(join(workspace, "data", dataFile), data);
  writeText(join(workspace, "src", "portal-view.mjs"), portalView({ lane, shape, dataFile }));
  writeText(join(workspace, "src", "workflow.mjs"), workflowStub({ lane }));
  writeText(join(workspace, "src", "render-proof.mjs"), renderScript({ lane, dataFile }));
  writeText(join(workspace, "tests", "acceptance.test.mjs"), acceptanceTest({ task, lane, shape, dataFile }));

  const test = spawnSync("npm", ["test"], { cwd: workspace, encoding: "utf8" });
  writeText(join(workspace, "tests-before.log"), `${test.stdout || ""}${test.stderr || ""}`);
  if (args.has("--require-failing-before") && test.status === 0) {
    throw new Error(`${task.id}/${lane} before-state unexpectedly passed`);
  }
}

function readme({ suite, task, lane }) {
  return `# ${suite.title}: ${task.title} (${lane})

This is a frozen target workspace for AST-Bench. The workflow is intentionally missing.

The acceptance test must fail before a coding agent implements \`src/workflow.mjs\`.

Run:

\`\`\`sh
npm test
npm run render
\`\`\`
`;
}

function agents({ task, lane }) {
  return `# AST-Bench Target Rules

- Implement only ${task.title}.
- Use the existing ${lane === "mongo" ? "document-shaped collections" : "normalized table-shaped data"} in data/.
- Do not change tests.
- Do not change generated fixture data.
- Run \`npm test\` before finishing.
- Keep the result behavior-equivalent to the acceptance contract.
`;
}

function schemaDoc({ task, lane, data }) {
  const objects = Object.entries(data).map(([name, value]) => {
    const row = Array.isArray(value) ? value[0] : value;
    const fields = row && typeof row === "object" ? Object.keys(row).slice(0, 18).join(", ") : "scalar";
    return `- ${name}: ${Array.isArray(value) ? value.length : 1} ${lane === "mongo" ? "document group" : "table rows"}, fields: ${fields}`;
  }).join("\n");
  return `# Schema Contract: ${task.title}

Lane: ${lane}

Business prompt:
${task.businessPrompt}

Expected outcome:
${task.expectedOutcome}

Native data shape:
${lane === "mongo"
    ? "Document-shaped collections keep hot workflow context close to the customer and subject records."
    : "Normalized tables keep entity boundaries explicit and require joins/reconstruction in workflow code."}

Objects:
${objects}
`;
}

function accessPathDoc({ task, lane, data }) {
  const dataObjects = Object.keys(data).join(", ");
  return `# Access Paths: ${task.title}

The coding agent must preserve the same user-visible behavior in both lanes.

Primary entity: ${task.primaryEntity}

Read path:
1. Load the workflow request.
2. Reconstruct account or subject context from ${dataObjects}.
3. Resolve owner groups and risk signals.
4. Persist workflow state, owner tasks, customer message, and audit event.
5. Render the portal projection.

Write path:
- Persist one workflow state.
- Persist all required owner tasks.
- Persist one customer-safe message.
- Persist one customer-visible audit event.

Fairness rule:
The lane may stay database-native, but it may not change tests or fixture data.
`;
}

function migrationDoc({ task, lane, data }) {
  if (lane === "mongo") {
    return `// Collection contract for ${task.title}
// Generated by AST-Bench target factory.
${Object.keys(data).map((name) => `db.createCollection("${name}");`).join("\n")}
`;
  }
  return `-- Table contract for ${task.title}
-- Generated by AST-Bench target factory.
${Object.entries(data).map(([name, rows]) => {
    const first = Array.isArray(rows) ? rows[0] : rows;
    const columns = first && typeof first === "object"
      ? Object.keys(first).map((key) => `  ${key} text`).join(",\n")
      : "  value text";
    return `CREATE TABLE ${name} (\n${columns}\n);`;
  }).join("\n\n")}
`;
}

function workflowStub() {
  return `import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  // TODO: Implement the benchmark workflow against the native data shape.
  return buildPortalView(db);
}
`;
}

function portalView({ lane, shape, dataFile }) {
  if (lane === "mongo") {
    return `export function buildPortalView(db) {
  const request = db.workflow_requests[0];
  const state = db.workflow_state.find((item) => item.requestId === request._id);
  const tasks = db.owner_tasks.filter((item) => item.requestId === request._id);
  const auditVisible = db.audit_events.some((item) => item.requestId === request._id && item.customerVisible);
  const message = db.customer_messages.find((item) => item.requestId === request._id);

  return {
    taskId: request.taskId,
    title: state?.title || request.title,
    status: state?.status || "Needs work",
    owner: tasks.length ? tasks.map((item) => item.ownerGroup).join(" + ") : "Unassigned",
    nextStep: state?.nextStep || "Waiting for workflow",
    riskSummary: state?.riskSignals?.length ? \`\${state.riskSignals.length} signals: \${state.riskSignals.map((item) => item.name).join(", ")}\` : "Risk not scored",
    tasks: \`\${tasks.length} owner tasks\`,
    history: auditVisible ? "Audit visible" : "Not visible",
    customerMessage: message?.body || "No customer-safe message"
  };
}
`;
  }

  // Postgres: shape-aware
  const signalsCode = shape === "shallow"
    ? `const signals = (request.risk_signals ? String(request.risk_signals).split("|") : []).map((entry) => {
    const idx = entry.indexOf(":");
    return { signal_name: idx >= 0 ? entry.slice(0, idx) : entry };
  });`
    : `const signals = tables.workflow_request_risk_signals
    .filter((item) => item.request_id === request.request_id)
    .sort((a, b) => a.signal_order - b.signal_order);`;

  return `export function buildPortalView(tables) {
  const request = tables.workflow_requests[0];
  const state = tables.workflow_state.find((item) => item.request_id === request.request_id);
  const tasks = tables.owner_tasks.filter((item) => item.request_id === request.request_id);
  const auditVisible = tables.audit_events.some((item) => item.request_id === request.request_id && item.customer_visible);
  const message = tables.customer_messages.find((item) => item.request_id === request.request_id);
  ${signalsCode}

  return {
    taskId: request.task_id,
    title: state?.title || request.title,
    status: state?.status || "Needs work",
    owner: tasks.length ? tasks.map((item) => item.owner_group).join(" + ") : "Unassigned",
    nextStep: state?.next_step || "Waiting for workflow",
    riskSummary: state ? \`\${signals.length} signals: \${signals.map((item) => item.signal_name).join(", ")}\` : "Risk not scored",
    tasks: \`\${tasks.length} owner tasks\`,
    history: auditVisible ? "Audit visible" : "Not visible",
    customerMessage: message?.body || "No customer-safe message"
  };
}
`;
}

function acceptanceTest({ task, lane, shape, dataFile }) {
  let expectedOwnersExpr, expectedSignalsExpr;

  if (lane === "mongo") {
    expectedOwnersExpr = "data.workflow_requests[0].ownerGroups";
    expectedSignalsExpr = "data.workflow_requests[0].riskSignals";
  } else if (shape === "shallow") {
    expectedOwnersExpr = "data.workflow_requests[0].owner_groups.split(\"|\")" ;
    expectedSignalsExpr = "data.workflow_requests[0].risk_signals.split(\"|\").map((entry) => { const i = entry.indexOf(\":\"); return { name: entry.slice(0, i), detail: entry.slice(i + 1) }; })";
  } else {
    expectedOwnersExpr = "data.workflow_request_owner_groups.slice().sort((a, b) => a.group_order - b.group_order).map((item) => item.owner_group)";
    expectedSignalsExpr = "data.workflow_request_risk_signals.slice().sort((a, b) => a.signal_order - b.signal_order).map((item) => ({ name: item.signal_name, detail: item.detail }))";
  }

  return `import { deepStrictEqual, strictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import { applyBenchmarkTask } from "../src/workflow.mjs";
import { buildPortalView } from "../src/portal-view.mjs";

const now = "2026-06-18T12:00:00.000Z";
const data = JSON.parse(readFileSync(new URL("../data/${dataFile}", import.meta.url), "utf8"));
const before = buildPortalView(structuredClone(data));
strictEqual(before.status, "Needs work", "Before state starts without the workflow");
strictEqual(before.history, "Not visible", "Before state has no customer-visible audit trail");
strictEqual(before.tasks, "0 owner tasks", "Before state has no owner tasks");

const runData = structuredClone(data);
const after = applyBenchmarkTask(runData, now);
const expectedStatus = ${JSON.stringify(task.expectedOutcome)};
const expectedOwners = ${expectedOwnersExpr};
const expectedSignals = ${expectedSignalsExpr};

strictEqual(after.status, expectedStatus, "Customer-facing status");
strictEqual(after.owner, expectedOwners.join(" + "), "Owner routing");
strictEqual(after.nextStep.length > 8, true, "Next step exists");
strictEqual(after.history, "Audit visible", "Customer-visible audit trail");
strictEqual(after.customerMessage.length > 12, true, "Customer-safe message");
strictEqual(after.riskSummary, \`\${expectedSignals.length} signals: \${expectedSignals.map((item) => item.name).join(", ")}\`, "Risk summary");
strictEqual(after.tasks, \`\${expectedOwners.length} owner tasks\`, "Owner task count");
assertPersistedState(runData, expectedStatus, expectedOwners, expectedSignals);

console.log("AST-Bench acceptance passed: ${task.id}/${lane}");

function assertPersistedState(${lane === "mongo" ? "db" : "tables"}, expectedStatus, expectedOwners, expectedSignals) {
  ${lane === "mongo" ? mongoAssertions() : postgresAssertions()}
}
`;
}

function mongoAssertions() {
  return `
  const request = db.workflow_requests[0];
  const state = db.workflow_state.find((item) => item.requestId === request._id);
  strictEqual(Boolean(state), true, "Workflow state must be persisted");
  strictEqual(state.status, expectedStatus, "Persisted status");
  deepStrictEqual(state.riskSignals.map((item) => item.name), expectedSignals.map((item) => item.name), "Persisted risk signals");
  const tasks = db.owner_tasks.filter((item) => item.requestId === request._id);
  strictEqual(tasks.length, expectedOwners.length, "Owner tasks persisted");
  deepStrictEqual(tasks.map((item) => item.ownerGroup), expectedOwners, "Task owner groups");
  strictEqual(tasks.every((item) => item.title && item.dueAt && item.status === "open"), true, "Tasks have production fields");
  strictEqual(db.customer_messages.some((item) => item.requestId === request._id && item.body), true, "Customer message persisted");
  strictEqual(db.audit_events.some((item) => item.requestId === request._id && item.customerVisible), true, "Customer-visible audit event persisted");`;
}

function postgresAssertions() {
  return `
  const request = tables.workflow_requests[0];
  const state = tables.workflow_state.find((item) => item.request_id === request.request_id);
  strictEqual(Boolean(state), true, "Workflow state must be persisted");
  strictEqual(state.status, expectedStatus, "Persisted status");
  const tasks = tables.owner_tasks.filter((item) => item.request_id === request.request_id);
  strictEqual(tasks.length, expectedOwners.length, "Owner tasks persisted");
  deepStrictEqual(tasks.map((item) => item.owner_group), expectedOwners, "Task owner groups");
  strictEqual(tasks.every((item) => item.title && item.due_at && item.status === "open"), true, "Tasks have production fields");
  strictEqual(tables.customer_messages.some((item) => item.request_id === request.request_id && item.body), true, "Customer message persisted");
  strictEqual(tables.audit_events.some((item) => item.request_id === request.request_id && item.customer_visible), true, "Customer-visible audit event persisted");`;
}

function renderScript({ lane, dataFile }) {
  return `import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { applyBenchmarkTask } from "./workflow.mjs";
import { buildPortalView } from "./portal-view.mjs";

const now = "2026-06-18T12:00:00.000Z";
const data = JSON.parse(readFileSync(new URL("../data/${dataFile}", import.meta.url), "utf8"));
const before = buildPortalView(structuredClone(data));
const runData = structuredClone(data);
const after = applyBenchmarkTask(runData, now);

mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/before-after.json", JSON.stringify({ lane: ${JSON.stringify(lane)}, before, after }, null, 2) + "\\n");
writeFileSync("artifacts/before-after.svg", svg({ before, after }));

function svg({ before, after }) {
  const rows = [
    ["Status", before.status, after.status],
    ["Owner", before.owner, after.owner],
    ["Next", before.nextStep, after.nextStep],
    ["Risk", before.riskSummary, after.riskSummary],
    ["Tasks", before.tasks, after.tasks],
    ["Audit", before.history, after.history]
  ];
  const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const body = rows.map((row, index) => {
    const y = 160 + index * 58;
    return \`<text x="52" y="\${y}" class="k">\${esc(row[0])}</text><text x="180" y="\${y}" class="v">\${esc(row[1])}</text><text x="620" y="\${y}" class="g">\${esc(row[2])}</text>\`;
  }).join("");
  return \`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="560" viewBox="0 0 1080 560">
    <style>.bg{fill:#0f1412}.card{fill:#f5f1e8;stroke:#d9d2bf}.h{font:800 28px system-ui;fill:#f5f1e8}.s{font:600 14px system-ui;fill:#b9c1b1}.k{font:700 14px system-ui;fill:#5a6256}.v{font:650 14px system-ui;fill:#171b17}.g{font:750 14px system-ui;fill:#087a4a}.line{stroke:#d9d2bf}</style>
    <rect class="bg" width="1080" height="560"/>
    <text x="40" y="50" class="h">AST-Bench Workflow State</text>
    <text x="40" y="78" class="s">${lane} target / deterministic fixture / captured by render script</text>
    <rect x="36" y="104" width="1008" height="390" rx="6" class="card"/>
    <text x="180" y="124" class="k">Before</text><text x="620" y="124" class="k">After</text>
    <line x1="150" y1="134" x2="150" y2="470" class="line"/><line x1="590" y1="134" x2="590" y2="470" class="line"/>
    \${body}
  </svg>\`;
}
`;
}
