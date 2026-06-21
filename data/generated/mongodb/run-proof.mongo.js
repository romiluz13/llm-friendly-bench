const fixtureVersion = "scenario-fixture-v2";
const orderId = "HX-20491";
const now = "2026-06-17T12:00:00.000Z";
const marker = "__MONGODB_LOCAL_PROOF__";
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
