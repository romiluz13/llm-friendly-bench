import { buildPortalView } from "./portal-view.mjs";

const ESCALATION_STATUS =
  "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

// Recovery SLA per owner group, in hours from escalation time.
const OWNER_TASK_HORIZON_HOURS = {
  "Customer Success": 4,
  Support: 8,
  Finance: 24,
  "Executive Sponsor": 12
};
const DEFAULT_TASK_HORIZON_HOURS = 24;

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const requestId = request._id;
  const account = db.accounts.find((item) => item._id === request.accountId);
  const at = now || request.generatedAt || new Date().toISOString();

  const riskSignals = request.riskSignals.map((signal) => ({
    name: signal.name,
    detail: signal.detail
  }));

  // Reconstruct the customer-safe context from the document-shaped collections.
  const contextLine = account
    ? `${account.tier} account ${account.name} (health ${account.context.healthScore}, ` +
      `usage ${account.context.usageTrend}, invoice risk ${account.context.invoiceRisk})`
    : request.title;

  const state = {
    _id: `state-${requestId}`,
    requestId,
    taskId: request.taskId,
    accountId: request.accountId,
    title: request.title,
    status: ESCALATION_STATUS,
    nextStep: request.nextStep || "Customer Success owner review",
    recoveryOwner: "Executive Sponsor",
    riskSignals,
    context: contextLine,
    updatedAt: at
  };

  const tasks = request.ownerGroups.map((ownerGroup, index) => ({
    _id: `task-${requestId}-${index + 1}`,
    requestId,
    ownerGroup,
    title: `${ownerGroup} recovery action for ${request.title}`,
    dueAt: addHours(at, OWNER_TASK_HORIZON_HOURS[ownerGroup] ?? DEFAULT_TASK_HORIZON_HOURS),
    status: "open",
    createdAt: at
  }));

  const customerMessage = {
    _id: `msg-${requestId}`,
    requestId,
    channel: "portal",
    visibility: "customer",
    body:
      request.customerMessage ||
      `${request.title} is being handled by ${request.ownerGroups.join(", ")}.`,
    sentAt: at
  };

  const auditEvent = {
    _id: `audit-${requestId}`,
    requestId,
    type: "escalation.activated",
    actor: "workflow-engine",
    summary:
      `At-risk escalation activated for ${request.title}; ` +
      `${riskSignals.length} risk signals routed to ${request.ownerGroups.join(", ")}.`,
    ownerGroups: request.ownerGroups,
    riskSignals: riskSignals.map((signal) => signal.name),
    customerVisible: true,
    occurredAt: at
  };

  // Upsert by requestId so re-running the workflow stays idempotent.
  replaceByRequestId(db, "workflow_state", requestId, [state]);
  replaceByRequestId(db, "owner_tasks", requestId, tasks);
  replaceByRequestId(db, "customer_messages", requestId, [customerMessage]);
  replaceByRequestId(db, "audit_events", requestId, [auditEvent]);

  return buildPortalView(db);
}

function replaceByRequestId(db, collection, requestId, records) {
  const existing = db[collection] || [];
  db[collection] = existing.filter((item) => item.requestId !== requestId).concat(records);
}

function addHours(iso, hours) {
  const base = new Date(iso);
  base.setUTCHours(base.getUTCHours() + hours);
  return base.toISOString();
}
