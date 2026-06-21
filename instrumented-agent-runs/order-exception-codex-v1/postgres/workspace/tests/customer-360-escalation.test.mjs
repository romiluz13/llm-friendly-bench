import { deepStrictEqual, strictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import { applyOrderException } from "../src/order-exception-workflow.mjs";
import { buildPortalView } from "../src/portal-view.mjs";

const now = "2026-06-17T12:00:00.000Z";
const orderId = "HX-20491";
const data = JSON.parse(readFileSync(new URL("../data/tables.json", import.meta.url), "utf8"));

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
  );
}
