#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { generateFixtureArtifacts } from "./proof-fixtures.mjs";

const now = "2026-06-17T12:00:00.000Z";
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27018/sql_hidden_cost";
const outputDir = "data/generated/proof";
const runnerPath = "data/generated/mongodb/run-proof.mongo.js";
const outputPath = `${outputDir}/mongodb-local-db-proof.json`;
const marker = "__MONGODB_LOCAL_PROOF__";

const { fixture } = generateFixtureArtifacts();

mkdirSync(outputDir, { recursive: true });
mkdirSync("data/generated/mongodb", { recursive: true });

run(process.execPath, ["scripts/seed-local-databases.mjs", "mongo"]);
writeFileSync(runnerPath, buildMongoProofScript({ fixture, now, marker }));

const result = runCapture("mongosh", [mongoUri, runnerPath]);
const proofLine = result.stdout.split(/\r?\n/).find((line) => line.startsWith(marker));
if (!proofLine) {
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  throw new Error("MongoDB local proof did not emit a proof result");
}

const proof = JSON.parse(proofLine.slice(marker.length));
const assertions = assertMongoLocalProof(proof);

writeFileSync(outputPath, `${JSON.stringify({
  status: "passed",
  generatedAt: now,
  mongoUri,
  fixtureVersion: fixture.scenarioVersion,
  orderId: fixture.task.orderId,
  accountId: fixture.task.accountId,
  assertions,
  ...proof
}, null, 2)}\n`);

console.log(`MongoDB local proof passed: ${outputPath}`);

function buildMongoProofScript({ fixture, now, marker }) {
  return `const fixtureVersion = ${JSON.stringify(fixture.scenarioVersion)};
const orderId = ${JSON.stringify(fixture.task.orderId)};
const now = ${JSON.stringify(now)};
const marker = ${JSON.stringify(marker)};
const riskFactors = [
  ["shipment delay", "Delayed high-value shipment is still unresolved."],
  ["strategic account", "Strategic tier account with enterprise-plus contract."],
  ["open support case", "Open urgent or high-priority support case exists."],
  ["invoice risk", "Past-due invoice or payment hold risk is active."],
  ["usage drop", "Recent usage dropped from the previous seven-day window."],
  ["regulatory review", "Regulated shipment or compliance review is still active."]
];

function portalView(id) {
  const order = db.orders.findOne({ _id: id, fixtureVersion });
  if (!order) throw new Error("Order not found: " + id);
  const account = db.accounts.findOne({ _id: order.accountId, fixtureVersion });
  const escalation = account?.currentEscalation || db.customer_escalations.findOne({ orderId: id, fixtureVersion });
  const tasks = escalation ? db.work_items.find({ escalationId: escalation.escalationId, fixtureVersion }).toArray() : [];
  const auditEvent = db.audit_events.findOne(
    { fixtureVersion, orderId: id, customerVisible: true },
    { sort: { occurredAt: -1 } }
  );

  return {
    orderId: id,
    title: escalation?.customerVisibleTitle || order.exception?.customerTitle || (order.status === "delayed" ? "Shipment delayed" : "Order status updated"),
    status: escalation?.customerVisibleStatus || order.exception?.customerStatus || order.status,
    owner: ownerGroupLabel(escalation?.ownerGroups || order.exception?.ownerGroups) || "Unassigned",
    nextStep: escalation?.nextStep || order.exception?.nextStep || "Contact support",
    history: auditEvent ? "Audit visible" : "Not visible",
    riskSummary: escalation?.riskFactors?.length
      ? escalation.riskFactors.length + " signals: " + escalation.riskFactors.map((item) => item.factor).join(", ")
      : "Risk not scored",
    tasks: tasks.length + " owner tasks",
    customerMessage: escalation?.customerMessage || "Contact support"
  };
}

function ownerGroupLabel(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(" + ");
  if (typeof value.toArray === "function") return value.toArray().join(" + ");
  return Object.values(value).join(" + ");
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function taskTitle(ownerGroup) {
  return {
    "Customer Success": "Coordinate executive recovery plan",
    Legal: "Review regulated shipment and disclosure language",
    Finance: "Resolve payment hold and invoice risk",
    Support: "Publish customer-safe support timeline"
  }[ownerGroup] || "Follow up for " + ownerGroup;
}

const before = portalView(orderId);
const order = db.orders.findOne({ _id: orderId, fixtureVersion });
const account = db.accounts.findOne({ _id: order.accountId, fixtureVersion });
const policy = db.escalation_policies.findOne({ policyId: "policy-strategic-customer-360-escalation", fixtureVersion });
const supportCases = db.support_cases.find({ accountId: account._id, status: { $ne: "closed" }, fixtureVersion }).toArray();
const invoiceRisks = db.invoice_snapshots.find({ accountId: account._id, fixtureVersion, $or: [{ status: "past_due" }, { risk: { $ne: null } }] }).toArray();
const usage = db.usage_snapshots.findOne({ accountId: account._id, trend: "down", fixtureVersion });
const compliance = db.compliance_reviews.findOne({ accountId: account._id, status: { $ne: "cleared" }, fixtureVersion });
const qualifies = Boolean(
  order.status === policy.appliesToStatus &&
  order.valueCents >= policy.minValueCents &&
  order.fulfillment?.delayed &&
  ["strategic", "enterprise"].includes(account.tier) &&
  account.contract?.arrCents >= 5000000 &&
  supportCases.length &&
  invoiceRisks.length &&
  usage &&
  (order.regulatedShipment || compliance)
);

if (!qualifies) throw new Error("Order does not qualify for the customer 360 escalation workflow");

const escalationId = "esc-" + orderId;
const ownerGroups = policy.ownerGroups || ["Customer Success", "Legal", "Finance", "Support"];
const escalation = {
  _id: escalationId,
  fixtureVersion,
  escalationId,
  accountId: account._id,
  orderId,
  policyId: policy.policyId,
  status: "active",
  customerVisibleTitle: policy.customerVisibleTitle,
  customerVisibleStatus: policy.customerVisibleStatus,
  ownerGroups,
  nextStep: policy.nextStep,
  customerMessage: policy.customerMessage,
  riskFactors: riskFactors.map(([factor, detail], index) => ({ order: index + 1, factor, detail })),
  createdAt: now
};
const tasks = ownerGroups.map((ownerGroup, index) => ({
  _id: "task-" + orderId + "-" + slug(ownerGroup),
  fixtureVersion,
  escalationId,
  accountId: account._id,
  orderId,
  ownerGroup,
  title: taskTitle(ownerGroup),
  status: "open",
  dueAt: "2026-06-17T16:00:00.000Z",
  sequence: index + 1
}));

const updateResult = db.orders.updateOne(
  { _id: orderId, fixtureVersion },
  {
    $set: {
      status: "customer_escalation_active",
      exception: {
        type: "customer_360_escalation",
        escalationId,
        customerTitle: policy.customerVisibleTitle,
        customerStatus: policy.customerVisibleStatus,
        ownerGroups,
        nextStep: policy.nextStep,
        riskFactors: escalation.riskFactors,
        routedAt: now
      }
    },
    $push: {
      statusHistory: {
        status: "customer_escalation_active",
        customerVisible: true,
        occurredAt: now,
        summary: "Strategic account escalation routed across Customer Success, Legal, Finance, and Support."
      }
    }
  }
);
db.accounts.updateOne(
  { _id: account._id, fixtureVersion },
  {
    $set: {
      currentEscalation: escalation,
      taskSummary: tasks.map((task) => ({ taskId: task._id, ownerGroup: task.ownerGroup, status: task.status }))
    }
  }
);
db.customer_escalations.insertOne(escalation);
db.work_items.insertMany(tasks);
db.audit_events.insertOne({
  _id: "audit-" + orderId + "-customer-360-escalation",
  fixtureVersion,
  orderId,
  accountId: account._id,
  escalationId,
  actor: "proof-runner",
  action: "route_customer_360_escalation",
  customerVisible: true,
  occurredAt: now
});

const after = portalView(orderId);
const collections = ["accounts", "orders", "products", "support_cases", "invoice_snapshots", "usage_snapshots", "compliance_reviews", "customer_escalations", "work_items", "audit_events", "escalation_policies", "sla_policies", "activities", "inventory_snapshots"];
const counts = Object.fromEntries(collections.map((name) => [name, db.getCollection(name).countDocuments({ fixtureVersion })]));

print(marker + JSON.stringify({
  before,
  after,
  counts,
  updateResult: {
    matchedCount: updateResult.matchedCount,
    modifiedCount: updateResult.modifiedCount
  }
}));
`;
}

function assertMongoLocalProof(proof) {
  const expected = [
    ["after.title", proof.after.title, "At-risk escalation active"],
    ["after.status", proof.after.status, "Executive escalation"],
    ["after.owner", proof.after.owner, "Customer Success + Legal + Finance + Support"],
    ["after.nextStep", proof.after.nextStep, "Executive recovery plan by 16:00"],
    ["after.history", proof.after.history, "Audit visible"],
    ["after.riskSummary", proof.after.riskSummary, "6 signals: shipment delay, strategic account, open support case, invoice risk, usage drop, regulatory review"],
    ["after.tasks", proof.after.tasks, "4 owner tasks"],
    ["after.customerMessage", proof.after.customerMessage, "We are coordinating executive recovery for your delayed shipment."],
    ["before.history", proof.before.history, "Not visible"],
    ["before.tasks", proof.before.tasks, "0 owner tasks"]
  ];
  const failures = expected.filter(([, actual, wanted]) => actual !== wanted);
  if (proof.updateResult.matchedCount !== 1 || proof.updateResult.modifiedCount !== 1) {
    failures.push(["updateResult", JSON.stringify(proof.updateResult), "one matched and modified document"]);
  }
  if (proof.counts.customer_escalations !== 1) {
    failures.push(["counts.customer_escalations", proof.counts.customer_escalations, 1]);
  }
  if (proof.counts.work_items !== 4) {
    failures.push(["counts.work_items", proof.counts.work_items, 4]);
  }
  if (proof.counts.audit_events !== 1) {
    failures.push(["counts.audit_events", proof.counts.audit_events, 1]);
  }
  if (failures.length) {
    for (const [field, actual, wanted] of failures) {
      console.error(`- ${field}: expected ${wanted}, got ${actual}`);
    }
    throw new Error("MongoDB local proof failed acceptance");
  }
  return expected.map(([field, actual]) => `${field} = ${actual}`);
}

function run(command, args) {
  const result = runCapture(command, args);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function runCapture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result;
}
