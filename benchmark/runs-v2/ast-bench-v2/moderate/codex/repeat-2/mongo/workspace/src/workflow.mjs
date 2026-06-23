import { buildPortalView } from "./portal-view.mjs";

const customerVisibleStatus = "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId);
  const activities = db.activities
    .filter((item) => item.subjectId === request._id)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const customerMessage = buildCustomerMessage(account);
  const workflowState = {
    _id: `${request._id}-workflow-state`,
    requestId: request._id,
    accountId: request.accountId,
    title: request.title,
    status: customerVisibleStatus,
    nextStep: request.nextStep,
    riskSignals: request.riskSignals.map((signal) => ({ ...signal })),
    ownerGroups: [...request.ownerGroups],
    customerMessage,
    accountContext: buildAccountContext(account),
    auditTimeline: activities.map((activity) => ({
      activityId: activity._id,
      occurredAt: activity.occurredAt,
      summary: activity.summary
    }))
  };
  const ownerTasks = request.ownerGroups.map((ownerGroup, index) => ({
    _id: `${request._id}-owner-task-${index + 1}`,
    requestId: request._id,
    accountId: request.accountId,
    ownerGroup,
    title: `${ownerGroup} recovery task`,
    dueAt: addHours(now, index + 2),
    status: "open",
    priority: index === 0 ? "urgent" : "high",
    context: buildAccountContext(account)
  }));
  const auditEvent = {
    _id: `${request._id}-audit-event`,
    requestId: request._id,
    accountId: request.accountId,
    customerVisible: true,
    eventType: "workflow-escalated",
    status: customerVisibleStatus,
    summary: customerVisibleStatus,
    occurredAt: now,
    timeline: workflowState.auditTimeline
  };

  db.workflow_state = replaceOneByRequestId(db.workflow_state, request._id, workflowState);
  db.owner_tasks = replaceManyByRequestId(db.owner_tasks, request._id, ownerTasks);
  db.customer_messages = replaceOneByRequestId(db.customer_messages, request._id, {
    _id: `${request._id}-customer-message`,
    requestId: request._id,
    accountId: request.accountId,
    body: customerMessage,
    audience: "customer",
    channel: "portal",
    visibleInPortal: true,
    status: "published",
    createdAt: now
  });
  db.audit_events = replaceOneByRequestId(db.audit_events, request._id, auditEvent);

  return buildPortalView(db);
}

function buildCustomerMessage(account) {
  const tier = account?.tier || "account";
  return `An executive recovery plan is active for this ${tier} order. We are coordinating the next checkpoint and keeping the portal updated with customer-visible progress.`;
}

function buildAccountContext(account) {
  const auditTrail = account?.context?.complianceFlags ?? [];
  return {
    tier: account?.tier,
    region: account?.region,
    contract: account?.contract,
    supportPlan: account?.contract?.supportPlan,
    invoiceRisk: account?.context?.invoiceRisk,
    usageTrend: account?.context?.usageTrend,
    openCases: account?.context?.openCases,
    complianceFlags: auditTrail,
    support: {
      plan: account?.contract?.supportPlan,
      openCases: account?.context?.openCases
    },
    invoice: {
      risk: account?.context?.invoiceRisk
    },
    usage: {
      trend: account?.context?.usageTrend
    },
    shipment: {
      status: "delayed",
      customerImpact: "high-value order at strategic account"
    },
    regulatory: {
      reviewRequired: auditTrail.includes("customer-visible-audit"),
      flags: auditTrail
    },
    audit: {
      customerVisible: auditTrail.includes("customer-visible-audit")
    }
  };
}

function addHours(isoTimestamp, hours) {
  const date = new Date(isoTimestamp);
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString();
}

function replaceOneByRequestId(items = [], requestId, nextItem) {
  const filtered = items.filter((item) => item.requestId !== requestId);
  return [...filtered, nextItem];
}

function replaceManyByRequestId(items = [], requestId, nextItems) {
  const filtered = items.filter((item) => item.requestId !== requestId);
  return [...filtered, ...nextItems];
}
