import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const suitePath = "benchmark/specs/ast-bench-v1.json";
export const benchmarkRoot = "benchmark";
export const targetRoot = "benchmark/targets";
export const runRoot = "benchmark/runs";
export const resultPath = "benchmark/results/summary.json";
export const publicBundlePath = "benchmark/public-bundle.json";
export const seedRunSummaryPath = "instrumented-agent-runs/order-exception-codex-v1/summary.json";
export const seedReplayPath = "prototypes/lab-console/replays/order-exception-codex-v1-verified.json";
export const seedEvidenceBundlePath = "prototypes/lab-console/evidence/order-exception-codex-v1/evidence-bundle.json";

export function readSuite() {
  return readJson(suitePath);
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

export function listTasks(suite) {
  return suite.domains.flatMap((domain, domainIndex) =>
    domain.tasks.map((task, taskIndex) => ({
      ...task,
      domainId: domain.id,
      domainLabel: domain.label,
      domainIndex,
      taskIndex
    }))
  );
}

export function expectedLaneRuns(suite) {
  return listTasks(suite).length * suite.lanes.length * suite.agents.length * suite.repeatsPerCell;
}

export function targetDir(taskId, lane) {
  return join(targetRoot, taskId, lane);
}

export function runDir({ suiteId, taskId, agentId, lane, repeat }) {
  return join(runRoot, suiteId, taskId, agentId, `repeat-${repeat}`, lane);
}

export function runManifestPath(cell) {
  return join(runDir(cell), "run-manifest.json");
}

export function targetWorkspacePath(taskId, lane) {
  return join(targetDir(taskId, lane), "workspace");
}

export function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function source(path) {
  return {
    path,
    exists: existsSync(path),
    bytes: existsSync(path) ? readFileSync(path).byteLength : 0,
    sha256: existsSync(path) ? sha256(path) : ""
  };
}

export function hashExisting(paths) {
  return paths.filter((path) => existsSync(path)).map((path) => ({
    path,
    sha256: sha256(path)
  }));
}

export function listFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  walk(root);
  return out;

  function walk(path) {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path).sort()) walk(join(path, entry));
      return;
    }
    out.push(path);
  }
}

export function readRunManifests(suite) {
  const manifests = [];
  for (const task of listTasks(suite)) {
    for (const agent of suite.agents) {
      for (let repeat = 1; repeat <= suite.repeatsPerCell; repeat += 1) {
        for (const lane of suite.lanes) {
          const path = runManifestPath({
            suiteId: suite.suiteId,
            taskId: task.id,
            agentId: agent.id,
            lane: lane.id,
            repeat
          });
          if (existsSync(path)) manifests.push(readJson(path));
        }
      }
    }
  }
  return manifests;
}

export function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values, pct) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

export function iqr(values) {
  return percentile(values, 75) - percentile(values, 25);
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));
}

export function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 10 ? 2 : 0
  }).format(Number(value) || 0);
}

export function formatMoneyShort(value) {
  const amount = Number(value) || 0;
  if (amount >= 1_000_000) return `$${Math.round(amount / 100000) / 10}M`;
  if (amount >= 1000) return `$${Math.round(amount / 100) / 10}k`;
  return formatMoney(amount);
}

export function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

export function slug(value) {
  return String(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
}

export function estimateTokensFromBytes(bytes) {
  return Math.ceil((Number(bytes) || 0) / 4);
}

export function benchmarkTaskPrompt(task, lane) {
  return `You are running AST-Bench, the Agent Schema Tax Benchmark.

Task:
${task.title}

Business request:
${task.businessPrompt}

Acceptance:
- The customer-facing status must be "${task.expectedOutcome}".
- Persist the workflow state, risk signals, owner tasks, customer message, and audit event.
- Keep the ${lane === "mongo" ? "MongoDB document-shaped" : "Postgres normalized relational"} model native.
- Run npm test and make it pass.

Rules:
- Do not change tests.
- Do not change generated fixture data.
- Do not hand-wave or simulate evidence.
- Make the smallest production-style source change needed.
`;
}

export function buildTaskFixture(task, lane) {
  const ownerGroups = ownerGroupsFor(task.primaryEntity);
  const riskSignals = riskSignalsFor(task);
  const now = "2026-06-18T12:00:00.000Z";
  const accountId = `acct-${slug(task.id).slice(0, 10)}`;
  const subjectId = `${task.primaryEntity}-${slug(task.id).slice(0, 12)}`;
  const customerName = `${task.domainLabel.split("/")[0].trim()} Account ${task.taskIndex + 1}`;
  const base = {
    fixtureVersion: `ast-bench-v1-${task.id}`,
    generatedAt: now,
    taskId: task.id,
    domainId: task.domainId,
    domainLabel: task.domainLabel,
    primaryEntity: task.primaryEntity,
    subjectId,
    accountId,
    customerName,
    title: task.title,
    businessPrompt: task.businessPrompt,
    expectedOutcome: task.expectedOutcome,
    ownerGroups,
    riskSignals,
    customerMessage: `${task.title} is being handled by ${ownerGroups.join(", ")}.`,
    nextStep: `${ownerGroups[0]} owner review by 16:00`,
    auditEvent: `${task.title} workflow activated`
  };

  if (lane === "mongo") return buildMongoFixture(base);
  return buildPostgresFixture(base);
}

function buildMongoFixture(base) {
  return {
    benchmark_fixture: {
      _id: base.fixtureVersion,
      suiteId: "ast-bench-v1",
      taskId: base.taskId,
      generatedAt: base.generatedAt
    },
    accounts: [
      {
        _id: base.accountId,
        name: base.customerName,
        tier: "enterprise",
        region: "NA",
        contract: {
          contractId: `ctr-${base.accountId}`,
          renewalDate: "2026-09-30",
          arrCents: 7200000,
          supportPlan: "platinum"
        },
        contacts: [
          { contactId: `ct-${base.accountId}-ops`, role: "Operations", email: `ops-${base.accountId}@example.test` },
          { contactId: `ct-${base.accountId}-finance`, role: "Finance", email: `finance-${base.accountId}@example.test` }
        ],
        context: {
          healthScore: 68,
          usageTrend: "down",
          openCases: 2,
          invoiceRisk: "medium",
          complianceFlags: ["customer-visible-audit"]
        }
      }
    ],
    workflow_requests: [
      {
        _id: base.subjectId,
        taskId: base.taskId,
        accountId: base.accountId,
        title: base.title,
        primaryEntity: base.primaryEntity,
        businessPrompt: base.businessPrompt,
        expectedOutcome: base.expectedOutcome,
        ownerGroups: base.ownerGroups,
        riskSignals: base.riskSignals,
        nextStep: base.nextStep,
        customerMessage: base.customerMessage
      }
    ],
    activities: base.riskSignals.map((signal, index) => ({
      _id: `act-${base.taskId}-${index + 1}`,
      accountId: base.accountId,
      subjectId: base.subjectId,
      summary: signal.detail,
      occurredAt: `2026-06-${10 + index}T10:00:00.000Z`
    })),
    workflow_state: [],
    owner_tasks: [],
    audit_events: [],
    customer_messages: []
  };
}

function buildPostgresFixture(base) {
  return {
    benchmark_fixture: [
      {
        fixture_version: base.fixtureVersion,
        suite_id: "ast-bench-v1",
        task_id: base.taskId,
        generated_at: base.generatedAt
      }
    ],
    accounts: [
      {
        account_id: base.accountId,
        name: base.customerName,
        tier: "enterprise",
        region: "NA"
      }
    ],
    account_contracts: [
      {
        contract_id: `ctr-${base.accountId}`,
        account_id: base.accountId,
        renewal_date: "2026-09-30",
        arr_cents: 7200000,
        support_plan: "platinum"
      }
    ],
    contacts: [
      { contact_id: `ct-${base.accountId}-ops`, account_id: base.accountId, role: "Operations", email: `ops-${base.accountId}@example.test` },
      { contact_id: `ct-${base.accountId}-finance`, account_id: base.accountId, role: "Finance", email: `finance-${base.accountId}@example.test` }
    ],
    workflow_requests: [
      {
        request_id: base.subjectId,
        task_id: base.taskId,
        account_id: base.accountId,
        title: base.title,
        primary_entity: base.primaryEntity,
        expected_outcome: base.expectedOutcome,
        next_step: base.nextStep,
        customer_message: base.customerMessage
      }
    ],
    workflow_request_owner_groups: base.ownerGroups.map((ownerGroup, index) => ({
      request_id: base.subjectId,
      owner_group: ownerGroup,
      group_order: index + 1
    })),
    workflow_request_risk_signals: base.riskSignals.map((signal, index) => ({
      request_id: base.subjectId,
      signal_name: signal.name,
      detail: signal.detail,
      signal_order: index + 1
    })),
    activities: base.riskSignals.map((signal, index) => ({
      activity_id: `act-${base.taskId}-${index + 1}`,
      account_id: base.accountId,
      subject_id: base.subjectId,
      summary: signal.detail,
      occurred_at: `2026-06-${10 + index}T10:00:00.000Z`
    })),
    workflow_state: [],
    owner_tasks: [],
    audit_events: [],
    customer_messages: []
  };
}

function ownerGroupsFor(primaryEntity) {
  const map = {
    account: ["Customer Success", "Support", "Finance", "Executive Sponsor"],
    order: ["Operations", "Support", "Finance", "Logistics"],
    case: ["Support", "Customer Success", "Product", "Operations"],
    invoice: ["Finance", "Customer Success", "Legal", "Operations"],
    audit: ["Compliance", "Legal", "Security", "Operations"]
  };
  return map[primaryEntity] || ["Operations", "Support", "Customer Success"];
}

function riskSignalsFor(task) {
  const words = task.title.toLowerCase().split(/\W+/).filter((word) => word.length > 3).slice(0, 3);
  const baseline = ["enterprise account", "open customer impact", "audit required"];
  return [...words, ...baseline].slice(0, 6).map((name, index) => ({
    name,
    detail: `${task.title} signal ${index + 1}: ${name}`
  }));
}
