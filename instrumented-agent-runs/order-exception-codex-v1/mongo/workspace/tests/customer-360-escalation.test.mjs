import { deepStrictEqual, strictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import { applyOrderException } from "../src/order-exception-workflow.mjs";
import { buildPortalView } from "../src/portal-view.mjs";

const now = "2026-06-17T12:00:00.000Z";
const orderId = "HX-20491";
const data = JSON.parse(readFileSync(new URL("../data/collections.json", import.meta.url), "utf8"));

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
  strictEqual(after[field], value, `Customer portal ${field}`);
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
  );
}
