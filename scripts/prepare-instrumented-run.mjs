#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { generateFixtureArtifacts, writeJson } from "./proof-fixtures.mjs";

const runId = process.env.RUN_ID || "order-exception-codex-v1";
const laneArg = process.argv[2] || "all";
const lanes = laneArg === "all" ? ["mongo", "postgres"] : [laneArg];
const root = "instrumented-agent-runs";
const { fixture, mongo, postgres } = generateFixtureArtifacts();

if (!lanes.every((lane) => ["mongo", "postgres"].includes(lane))) {
  throw new Error("Usage: node scripts/prepare-instrumented-run.mjs [mongo|postgres|all]");
}

for (const lane of lanes) {
  const runDir = join(root, runId, lane);
  const workspaceDir = join(runDir, "workspace");
  rmSync(workspaceDir, { recursive: true, force: true });
  mkdirSync(workspaceDir, { recursive: true });
  mkdirSync(join(runDir, "raw-transcript"), { recursive: true });
  mkdirSync(join(runDir, "screenshots"), { recursive: true });
  mkdirSync(join(runDir, "db-before"), { recursive: true });
  mkdirSync(join(runDir, "db-after"), { recursive: true });

  const data = lane === "mongo" ? mongo : postgres;
  writeWorkspace({ lane, workspaceDir, data });
  writeJson(join(runDir, "run-manifest.json"), preparedManifest({ lane, runDir }));
  writeText(join(runDir, "prompt.md"), taskPrompt(lane));
  writeJson(join(runDir, "db-before", lane === "mongo" ? "collections.json" : "tables.json"), data);

  run("git", ["init"], workspaceDir);
  run("git", ["config", "user.email", "proof-lab@example.local"], workspaceDir);
  run("git", ["config", "user.name", "Proof Lab"], workspaceDir);
  run("git", ["add", "."], workspaceDir);
  run("git", ["commit", "-m", "Frozen before state"], workspaceDir);

  const test = spawnSync("npm", ["test"], { cwd: workspaceDir, encoding: "utf8" });
  writeText(join(runDir, "tests-before.log"), `${test.stdout || ""}${test.stderr || ""}`);
  if (test.status === 0) {
    throw new Error(`${lane} before-state tests unexpectedly passed; the run would not prove agent work`);
  }

  console.log(`Prepared ${lane} instrumented run workspace: ${workspaceDir}`);
}

function writeWorkspace({ lane, workspaceDir, data }) {
  writeJson(join(workspaceDir, "package.json"), {
    name: `customer-360-escalation-${lane}-target`,
    version: "0.2.0",
    private: true,
    type: "module",
    scripts: {
      test: "node tests/customer-360-escalation.test.mjs",
      render: "node src/render-portal.mjs"
    }
  });
  writeText(join(workspaceDir, "README.md"), workspaceReadme(lane));
  writeText(join(workspaceDir, "AGENTS.md"), workspaceAgents(lane));
  writeJson(join(workspaceDir, "data", lane === "mongo" ? "collections.json" : "tables.json"), data);
  writeText(join(workspaceDir, "src", "order-exception-workflow.mjs"), lane === "mongo" ? mongoWorkflowStub() : postgresWorkflowStub());
  writeText(join(workspaceDir, "src", "portal-view.mjs"), lane === "mongo" ? mongoPortalView() : postgresPortalView());
  writeText(join(workspaceDir, "src", "render-portal.mjs"), renderPortalScript(lane));
  writeText(join(workspaceDir, "tests", "customer-360-escalation.test.mjs"), acceptanceTest(lane));
}

function workspaceReadme(lane) {
  return `# ${lane === "mongo" ? "MongoDB" : "Postgres"} Customer 360 Escalation Target

This is a frozen before-state workspace for an Instrumented Agent Run.

Run:

\`\`\`sh
npm test
\`\`\`

The test must fail before the coding agent implements the Customer 360 Escalation Workflow. The agent should modify source code only, run the test, and leave a reviewable git diff.
`;
}

function workspaceAgents(lane) {
  return `# Instrumented Agent Run Rules

- Implement only the at-risk Customer 360 Escalation Workflow.
- Use the existing ${lane === "mongo" ? "document-shaped collections" : "normalized table-shaped data"} in data/.
- Do not change the test expectations.
- Run \`npm test\` before finishing.
- Keep the customer-visible result identical to the acceptance contract.
`;
}

function mongoWorkflowStub() {
  return `import { buildPortalView } from "./portal-view.mjs";

export function applyOrderException(db, orderId, now) {
  // TODO: Implement the at-risk customer 360 escalation workflow.
  return buildPortalView(db, orderId);
}
`;
}

function postgresWorkflowStub() {
  return `import { buildPortalView } from "./portal-view.mjs";

export function applyOrderException(tables, orderId, now) {
  // TODO: Implement the at-risk customer 360 escalation workflow.
  return buildPortalView(tables, orderId);
}
`;
}

function mongoPortalView() {
  return `export function buildPortalView(db, orderId) {
  const order = db.orders.find((item) => item._id === orderId);
  if (!order) throw new Error(\`Order not found: \${orderId}\`);
  const account = db.accounts.find((item) => item._id === order.accountId);
  const supportCase = db.support_cases.find((item) => item.orderId === orderId) ||
    db.support_cases.find((item) => item.accountId === order.accountId && item.status !== "closed");
  const escalation = account?.currentEscalation ||
    db.customer_escalations.find((item) => item.orderId === orderId);
  const tasks = db.work_items.filter((item) => item.escalationId === escalation?.escalationId);
  const auditVisible = db.audit_events.some((item) =>
    item.customerVisible &&
    (item.orderId === orderId || item.escalationId === escalation?.escalationId || item.subject?.id === escalation?.escalationId)
  );

  return {
    orderId,
    accountId: account?._id,
    accountName: account?.name,
    caseId: supportCase?.caseId,
    title: escalation?.customerVisibleTitle || order.exception?.customerTitle || (order.status === "delayed" ? "Shipment delayed" : "Order in progress"),
    status: escalation?.customerVisibleStatus || order.exception?.customerStatus || order.status,
    owner: escalation?.ownerGroups?.join(" + ") || order.exception?.ownerGroups?.join(" + ") || "Unassigned",
    nextStep: escalation?.nextStep || order.exception?.nextStep || "Contact support",
    history: auditVisible ? "Audit visible" : "Not visible",
    riskSummary: escalation?.riskFactors?.length
      ? \`\${escalation.riskFactors.length} signals: \${escalation.riskFactors.map((item) => item.factor).join(", ")}\`
      : "Risk not scored",
    tasks: \`\${tasks.length} owner tasks\`,
    customerMessage: escalation?.customerMessage || "Contact support"
  };
}
`;
}

function postgresPortalView() {
  return `export function buildPortalView(tables, orderId) {
  const order = tables.orders.find((item) => item.order_id === orderId);
  if (!order) throw new Error(\`Order not found: \${orderId}\`);
  const account = tables.accounts.find((item) => item.account_id === order.account_id);
  const supportCase = tables.support_cases.find((item) => item.order_id === orderId) ||
    tables.support_cases.find((item) => item.account_id === order.account_id && item.status !== "closed");
  const escalation = tables.customer_escalations.find((item) => item.order_id === orderId);
  const ownerGroups = tables.escalation_tasks
    .filter((item) => item.escalation_id === escalation?.escalation_id)
    .map((item) => item.owner_group);
  const riskFactors = tables.escalation_risk_factors
    .filter((item) => item.escalation_id === escalation?.escalation_id)
    .sort((a, b) => a.factor_order - b.factor_order);
  const portalMessage = tables.customer_portal_messages.find((item) => item.escalation_id === escalation?.escalation_id);
  const auditVisible = tables.audit_events.some((item) =>
    item.customer_visible &&
    (item.subject_id === escalation?.escalation_id ||
      tables.audit_subjects.some((subject) => subject.audit_id === item.audit_id && subject.subject_id === orderId))
  );

  return {
    orderId,
    accountId: account?.account_id,
    accountName: account?.name,
    caseId: supportCase?.case_id,
    title: escalation?.customer_visible_title || (order.current_status === "delayed" ? "Shipment delayed" : "Order in progress"),
    status: escalation?.customer_visible_status || order.current_status,
    owner: ownerGroups.length ? ownerGroups.join(" + ") : "Unassigned",
    nextStep: escalation?.next_step || "Contact support",
    history: auditVisible ? "Audit visible" : "Not visible",
    riskSummary: riskFactors.length ? \`\${riskFactors.length} signals: \${riskFactors.map((item) => item.factor).join(", ")}\` : "Risk not scored",
    tasks: \`\${ownerGroups.length} owner tasks\`,
    customerMessage: portalMessage?.body || escalation?.customer_message || "Contact support"
  };
}
`;
}

function acceptanceTest(lane) {
  const dataFile = lane === "mongo" ? "collections.json" : "tables.json";
  return `import { deepStrictEqual, strictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import { applyOrderException } from "../src/order-exception-workflow.mjs";
import { buildPortalView } from "../src/portal-view.mjs";

const now = "2026-06-17T12:00:00.000Z";
const orderId = "HX-20491";
const data = JSON.parse(readFileSync(new URL("../data/${dataFile}", import.meta.url), "utf8"));

const before = buildPortalView(structuredClone(data), orderId);
strictEqual(before.title, "Shipment delayed", "Before state should show the ordinary delayed shipment");
strictEqual(before.history, "Not visible", "Before state should not expose audit history");
strictEqual(before.riskSummary, "Risk not scored", "Before state should not have an escalation risk summary");
strictEqual(before.tasks, "0 owner tasks", "Before state should not have escalation tasks");

const runData = structuredClone(data);
const after = applyOrderException(runData, orderId, now);
const expected = {
  title: "At-risk escalation active",
  status: "Executive escalation",
  owner: "Customer Success + Legal + Finance + Support",
  nextStep: "Executive recovery plan by 16:00",
  history: "Audit visible",
  riskSummary: "6 signals: shipment delay, strategic account, open support case, invoice risk, usage drop, regulatory review",
  tasks: "4 owner tasks",
  customerMessage: "We are coordinating executive recovery for your delayed shipment."
};

for (const [field, value] of Object.entries(expected)) {
  strictEqual(after[field], value, \`Customer portal \${field}\`);
}
assertWorkflowState(runData);
deepStrictEqual(
  {
    title: after.title,
    status: after.status,
    owner: after.owner,
    nextStep: after.nextStep,
    history: after.history,
    riskSummary: after.riskSummary,
    tasks: after.tasks,
    customerMessage: after.customerMessage
  },
  expected,
  "Customer-visible portal projection must match the escalation acceptance contract"
);

console.log("Customer 360 Escalation Workflow acceptance passed");

function assertWorkflowState(runData) {
  const ownerGroups = ["Customer Success", "Legal", "Finance", "Support"];
  const riskFactors = ["shipment delay", "strategic account", "open support case", "invoice risk", "usage drop", "regulatory review"];
  ${lane === "mongo" ? mongoStateAssertions() : postgresStateAssertions()}
}
`;
}

function mongoStateAssertions() {
  return `
  const escalation = runData.customer_escalations.find((item) => item.orderId === orderId);
  strictEqual(Boolean(escalation), true, "MongoDB escalation must be persisted");
  deepStrictEqual(escalation.ownerGroups, ownerGroups, "MongoDB escalation owner groups");
  deepStrictEqual(escalation.riskFactors.map((item) => item.factor), riskFactors, "MongoDB escalation risk factor names");
  strictEqual(escalation.riskFactors.every((item) => item.detail || item.evidence), true, "MongoDB risk factors need details or evidence");

  const tasks = runData.work_items.filter((item) => item.escalationId === escalation.escalationId);
  strictEqual(tasks.length, 4, "MongoDB must persist four owner tasks");
  deepStrictEqual(tasks.map((item) => item.ownerGroup), ownerGroups, "MongoDB task owner groups");
  strictEqual(tasks.every((item) => item.accountId === "acct-nova" && item.orderId === orderId), true, "MongoDB tasks need account and order context");
  strictEqual(tasks.every((item) => item.title && item.status === "open" && item.dueAt), true, "MongoDB tasks need title, open status, and due time");

  strictEqual(
    runData.audit_events.some((item) => item.customerVisible && (item.orderId === orderId || item.escalationId === escalation.escalationId)),
    true,
    "MongoDB must persist a customer-visible audit event"
  );`;
}

function postgresStateAssertions() {
  return `
  const escalation = runData.customer_escalations.find((item) => item.order_id === orderId);
  strictEqual(Boolean(escalation), true, "Postgres escalation must be persisted");

  const factors = runData.escalation_risk_factors
    .filter((item) => item.escalation_id === escalation.escalation_id)
    .sort((a, b) => a.factor_order - b.factor_order);
  strictEqual(factors.length, 6, "Postgres must persist six risk factor rows");
  deepStrictEqual(factors.map((item) => item.factor), riskFactors, "Postgres escalation risk factor names");
  strictEqual(factors.every((item) => item.detail), true, "Postgres risk factors need detail text");

  const tasks = runData.escalation_tasks.filter((item) => item.escalation_id === escalation.escalation_id);
  strictEqual(tasks.length, 4, "Postgres must persist four owner tasks");
  deepStrictEqual(tasks.map((item) => item.owner_group), ownerGroups, "Postgres task owner groups");
  strictEqual(tasks.every((item) => item.account_id === "acct-nova" && item.order_id === orderId), true, "Postgres tasks need account and order context");
  strictEqual(tasks.every((item) => item.title && item.status === "open" && item.due_at), true, "Postgres tasks need title, open status, and due time");

  const portalMessage = runData.customer_portal_messages.find((item) => item.escalation_id === escalation.escalation_id);
  strictEqual(portalMessage?.body, expected.customerMessage, "Postgres must persist the customer-safe portal message");
  strictEqual(runData.legal_review_requests.some((item) => item.escalation_id === escalation.escalation_id), true, "Postgres must create legal review request");
  strictEqual(runData.finance_review_requests.some((item) => item.escalation_id === escalation.escalation_id), true, "Postgres must create finance review request");
  strictEqual(
    runData.audit_events.some((item) => item.customer_visible && item.subject_id === escalation.escalation_id),
    true,
    "Postgres must persist a customer-visible audit event"
  );
  strictEqual(
    runData.audit_subjects.some((item) => item.subject_id === orderId),
    true,
    "Postgres audit subject must link back to the order"
  );`;
}

function renderPortalScript(lane) {
  const dataFile = lane === "mongo" ? "collections.json" : "tables.json";
  return `import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { applyOrderException } from "./order-exception-workflow.mjs";
import { buildPortalView } from "./portal-view.mjs";

const now = "2026-06-17T12:00:00.000Z";
const orderId = "HX-20491";
const data = JSON.parse(readFileSync(new URL("../data/${dataFile}", import.meta.url), "utf8"));
const before = buildPortalView(structuredClone(data), orderId);
const after = applyOrderException(structuredClone(data), orderId, now);

mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/customer-portal-before-after.json", JSON.stringify({ lane: ${JSON.stringify(lane)}, before, after }, null, 2) + "\\n");
writeFileSync("artifacts/customer-portal-before-after.svg", svg({ lane: ${JSON.stringify(lane)}, before, after }));

function svg({ lane, before, after }) {
  const rows = [
    ["Status", before.status, after.status],
    ["Owner", before.owner, after.owner],
    ["Next step", before.nextStep, after.nextStep],
    ["History", before.history, after.history],
    ["Risk", before.riskSummary, after.riskSummary],
    ["Tasks", before.tasks, after.tasks]
  ];
  const escaped = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const rowSvg = rows.map((row, index) => {
    const y = 196 + index * 58;
    return \`<text x="70" y="\${y}" class="k">\${escaped(row[0])}</text><text x="230" y="\${y}" class="v">\${escaped(row[1])}</text><text x="650" y="\${y}" class="v good">\${escaped(row[2])}</text>\`;
  }).join("");
  return \`<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="650" viewBox="0 0 1180 650">
  <style>
    .bg{fill:#111311}.panel{fill:#f4f1e8;stroke:#d8d0bd}.h{font:700 30px system-ui;fill:#f4f1e8}.sub{font:600 14px system-ui;fill:#a9af9d}.title{font:800 25px system-ui;fill:#151711}.k{font:700 15px system-ui;fill:#5f6659}.v{font:700 15px system-ui;fill:#151711}.good{fill:#0a7f4b}.label{font:800 12px system-ui;fill:#5f6659;letter-spacing:2px}.line{stroke:#d8d0bd}
  </style>
  <rect width="1180" height="650" class="bg"/>
  <text x="48" y="58" class="h">Customer 360 Escalation Proof Snapshot</text>
  <text x="48" y="86" class="sub">\${escaped(lane)} lane / Order HX-20491 / Instrumented Agent Run artifact</text>
  <rect x="48" y="122" width="510" height="444" class="panel"/>
  <rect x="620" y="122" width="510" height="444" class="panel"/>
  <text x="70" y="154" class="label">BEFORE</text><text x="642" y="154" class="label">AFTER</text>
  <text x="70" y="118" class="title">\${escaped(before.title)}</text>
  <text x="642" y="118" class="title">\${escaped(after.title)}</text>
  <line x1="200" y1="168" x2="200" y2="532" class="line"/><line x1="620" y1="168" x2="620" y2="532" class="line"/>
  \${rowSvg}
</svg>\`;
}
`;
}

function preparedManifest({ lane, runDir }) {
  return {
    schemaVersion: "1.0.0",
    runId,
    lane,
    agent: {
      name: "Codex",
      cliVersion: codexVersion(),
      mode: "codex exec"
    },
    scenario: {
      fixtureVersion: fixture.scenarioVersion,
      orderId: fixture.task.orderId,
      accountId: fixture.task.accountId,
      taskPrompt: taskPrompt(lane)
    },
    status: "prepared",
    startedAt: "",
    finishedAt: "",
    artifacts: {
      workspace: join(runDir, "workspace"),
      prompt: join(runDir, "prompt.md"),
      beforeDb: join(runDir, "db-before", lane === "mongo" ? "collections.json" : "tables.json"),
      testsBefore: join(runDir, "tests-before.log")
    },
    metrics: {
      elapsedMs: 0,
      transcriptBytes: 0,
      estimatedTranscriptTokens: 0,
      diffBytes: 0,
      filesChanged: 0,
      testStatus: "not-run",
      retrySignals: 0
    }
  };
}

function taskPrompt(lane) {
  return `You are running an Instrumented Agent Run for MongoDB's Interactive Proof Lab.

Task:
Implement the at-risk Customer 360 Escalation Workflow for order HX-20491 / account acct-nova.

Business request:
Detect a delayed high-value order for a strategic account, combine CRM context, open support cases, invoice/payment risk, contract tier, recent product usage, shipment status, regulatory flags, and audit history. Route the account to Customer Success, Legal, Finance, and Support, show the customer-safe status in the portal, create internal owner tasks, and preserve a full audit timeline.

Acceptance:
- The customer portal title is "At-risk escalation active".
- Current status is "Executive escalation".
- Visible owner is "Customer Success + Legal + Finance + Support".
- Next step is "Executive recovery plan by 16:00".
- Risk summary is "6 signals: shipment delay, strategic account, open support case, invoice risk, usage drop, regulatory review".
- Tasks is "4 owner tasks".
- Audit history is visible.
- Customer message is "We are coordinating executive recovery for your delayed shipment."
- Persist the escalation state, all six risk factors with detail, four owner tasks with account/order/title/due context, customer portal message, and audit linkage.
- Run npm test and make it pass.

Rules:
- Do not change tests.
- Do not change generated fixture data.
- Keep the ${lane === "mongo" ? "MongoDB document-shaped" : "Postgres normalized table-shaped"} model native.
- Make the smallest production-style code change needed.
`;
}

function codexVersion() {
  try {
    return execFileSync("codex", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return "codex unavailable";
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed in ${cwd}\n${result.stdout || ""}${result.stderr || ""}`);
  }
}

function writeText(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}
