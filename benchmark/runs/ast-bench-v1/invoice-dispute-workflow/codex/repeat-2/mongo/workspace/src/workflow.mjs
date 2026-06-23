import { buildPortalView } from "./portal-view.mjs";

const CUSTOMER_STATUS = "Invoice dispute active with finance owner, evidence bundle, and customer-safe status.";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId);
  const activities = db.activities
    .filter((item) => item.accountId === request.accountId && item.subjectId === request._id)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const ownerGroups = [...request.ownerGroups];
  const riskSignals = request.riskSignals.map((signal) => ({ ...signal }));
  const dueAt = `${now.slice(0, 10)}T16:00:00.000Z`;
  const accountId = account?._id ?? request.accountId;

  const evidenceBundle = {
    contract: account?.contract ? structuredClone(account.contract) : null,
    accountContext: account?.context ? structuredClone(account.context) : null,
    timeline: activities.map((item) => ({
      activityId: item._id,
      summary: item.summary,
      occurredAt: item.occurredAt
    }))
  };

  db.workflow_state = db.workflow_state.filter((item) => item.requestId !== request._id);
  db.workflow_state.push({
    _id: `state-${request._id}`,
    requestId: request._id,
    accountId,
    taskId: request.taskId,
    title: request.title,
    status: CUSTOMER_STATUS,
    nextStep: request.nextStep,
    ownerGroups,
    financeOwner: ownerGroups.find((item) => item === "Finance") ?? ownerGroups[0] ?? null,
    riskSignals,
    evidenceBundle,
    customerMessage: request.customerMessage,
    createdAt: now,
    updatedAt: now
  });

  db.owner_tasks = db.owner_tasks.filter((item) => item.requestId !== request._id);
  db.owner_tasks.push(...ownerGroups.map((ownerGroup, index) => ({
    _id: `task-${request._id}-${index + 1}`,
    requestId: request._id,
    accountId,
    ownerGroup,
    title: `${ownerGroup}: ${request.title}`,
    status: "open",
    dueAt,
    createdAt: now
  })));

  db.customer_messages = db.customer_messages.filter((item) => item.requestId !== request._id);
  db.customer_messages.push({
    _id: `msg-${request._id}`,
    requestId: request._id,
    accountId,
    channel: "portal",
    body: request.customerMessage,
    customerSafe: true,
    customerVisible: true,
    createdAt: now
  });

  db.audit_events = db.audit_events.filter((item) => item.requestId !== request._id);
  db.audit_events.push({
    _id: `audit-${request._id}`,
    requestId: request._id,
    accountId,
    eventType: "invoice-dispute-workflow-activated",
    summary: CUSTOMER_STATUS,
    ownerGroups,
    riskSignalNames: riskSignals.map((item) => item.name),
    evidenceCount: evidenceBundle.timeline.length,
    customerVisible: true,
    occurredAt: now,
    createdAt: now
  });

  return buildPortalView(db);
}
