export const mongoTouchedFiles = [
  "targets/mongodb-app/src/order-exception-workflow.mjs",
  "targets/mongodb-app/schema/design.json",
  "data/generated/mongodb/collections.json",
  "targets/shared/portal-view.mjs",
  "targets/shared/acceptance.mjs",
  "prototypes/lab-console/replays/order-exception-codex-v1-candidate.json"
];

const expectedOwnerGroups = ["Customer Success", "Legal", "Finance", "Support"];
const expectedRiskFactors = [
  ["shipment delay", "Delayed high-value shipment is still unresolved."],
  ["strategic account", "Strategic tier account with enterprise-plus contract."],
  ["open support case", "Open urgent or high-priority support case exists."],
  ["invoice risk", "Past-due invoice or payment hold risk is active."],
  ["usage drop", "Recent usage dropped from the previous seven-day window."],
  ["regulatory review", "Regulated shipment or compliance review is still active."]
];

export function applyMongoOrderException(db, orderId, now) {
  const order = db.orders.find((item) => item._id === orderId);
  if (!order) throw new Error(`MongoDB order not found: ${orderId}`);

  const account = db.accounts.find((item) => item._id === order.accountId);
  if (!account) throw new Error(`MongoDB account not found: ${order.accountId}`);

  const policy = db.escalation_policies.find((item) => item.policyId === "policy-strategic-customer-360-escalation");
  if (!policy) throw new Error("MongoDB escalation policy not found");

  const supportCases = db.support_cases.filter((item) => item.accountId === account._id && item.status !== "closed");
  const invoiceRisks = db.invoice_snapshots.filter((item) => item.accountId === account._id && (item.status === "past_due" || item.risk));
  const usage = db.usage_snapshots.find((item) => item.accountId === account._id && item.trend === "down");
  const compliance = db.compliance_reviews.find((item) =>
    item.accountId === account._id &&
    (item.orderId === orderId || item.status !== "cleared") &&
    item.status !== "cleared"
  );
  const isStrategic = ["strategic", "enterprise"].includes(account.tier) && account.contract?.arrCents >= 5000000;
  const qualifies = Boolean(
    order.status === policy.appliesToStatus &&
    order.valueCents >= policy.minValueCents &&
    order.fulfillment?.delayed &&
    isStrategic &&
    supportCases.length &&
    invoiceRisks.length &&
    usage &&
    (order.regulatedShipment || compliance)
  );

  if (!qualifies) return buildMongoPortalView(db, orderId);

  const escalationId = `esc-${orderId}`;
  const riskFactors = expectedRiskFactors.map(([factor, detail], index) => ({ order: index + 1, factor, detail }));
  const ownerGroups = policy.ownerGroups || expectedOwnerGroups;
  const tasks = ownerGroups.map((ownerGroup, index) => ({
    _id: `task-${orderId}-${slug(ownerGroup)}`,
    escalationId,
    accountId: account._id,
    orderId,
    ownerGroup,
    title: taskTitle(ownerGroup),
    status: "open",
    dueAt: "2026-06-17T16:00:00.000Z",
    sequence: index + 1
  }));
  const escalation = {
    _id: escalationId,
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
    riskFactors,
    createdAt: now
  };

  order.status = "customer_escalation_active";
  order.exception = {
    type: "customer_360_escalation",
    escalationId,
    customerTitle: policy.customerVisibleTitle,
    customerStatus: policy.customerVisibleStatus,
    ownerGroups,
    nextStep: policy.nextStep,
    riskFactors,
    routedAt: now
  };
  order.statusHistory.push({
    status: "customer_escalation_active",
    customerVisible: true,
    occurredAt: now,
    summary: "Strategic account escalation routed across Customer Success, Legal, Finance, and Support."
  });

  account.currentEscalation = escalation;
  account.taskSummary = tasks.map((task) => ({ taskId: task._id, ownerGroup: task.ownerGroup, status: task.status }));
  db.customer_escalations.push(escalation);
  db.work_items.push(...tasks);
  db.audit_events.push({
    _id: `audit-${orderId}-customer-360-escalation`,
    subject: { type: "customer_escalation", id: escalationId },
    accountId: account._id,
    orderId,
    escalationId,
    actor: "proof-runner",
    action: "route_customer_360_escalation",
    customerVisible: true,
    occurredAt: now,
    diff: {
      status: ["delayed", "customer_escalation_active"],
      ownerGroups,
      riskFactors: riskFactors.map((item) => item.factor)
    }
  });

  return buildMongoPortalView(db, orderId);
}

export function buildMongoPortalView(db, orderId) {
  const order = db.orders.find((item) => item._id === orderId);
  if (!order) throw new Error(`MongoDB order not found: ${orderId}`);

  const account = db.accounts.find((item) => item._id === order.accountId);
  const supportCase = db.support_cases.find((item) => item.orderId === orderId) ||
    db.support_cases.find((item) => item.accountId === order.accountId && item.status !== "closed");
  const escalation = account?.currentEscalation ||
    db.customer_escalations.find((item) => item.orderId === orderId);
  const auditVisible = db.audit_events.some((item) =>
    (item.orderId === orderId || item.subject?.id === escalation?.escalationId) &&
    item.customerVisible
  );
  const tasks = db.work_items.filter((item) => item.escalationId === escalation?.escalationId);

  return {
    orderId,
    accountId: account?._id,
    accountName: account?.name,
    caseId: supportCase?.caseId,
    title: escalation?.customerVisibleTitle || order.exception?.customerTitle || (order.status === "delayed" ? "Shipment delayed" : "Order in progress"),
    status: escalation?.customerVisibleStatus || order.exception?.customerStatus || order.status,
    owner: escalation?.ownerGroups?.join(" + ") || "Unassigned",
    nextStep: escalation?.nextStep || "Contact support",
    history: auditVisible ? "Audit visible" : "Not visible",
    riskSummary: escalation?.riskFactors?.length
      ? `${escalation.riskFactors.length} signals: ${escalation.riskFactors.map((item) => item.factor).join(", ")}`
      : "Risk not scored",
    tasks: `${tasks.length} owner tasks`,
    customerMessage: escalation?.customerMessage || "Contact support"
  };
}

function taskTitle(ownerGroup) {
  return {
    "Customer Success": "Coordinate executive recovery plan",
    Legal: "Review regulated shipment and disclosure language",
    Finance: "Resolve payment hold and invoice risk",
    Support: "Publish customer-safe support timeline"
  }[ownerGroup] || `Follow up for ${ownerGroup}`;
}

function slug(value) {
  return String(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
}
