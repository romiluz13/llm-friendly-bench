import { buildPortalView } from "./portal-view.mjs";

const OWNER_TASK_DUE_HOURS = 24;

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const escalatedAt = now;
  const dueAt = addHours(now, OWNER_TASK_DUE_HOURS);

  const riskSignals = request.riskSignals.map((signal) => ({
    name: signal.name,
    detail: signal.detail
  }));

  db.workflow_state.push({
    _id: `state-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    title: request.title,
    status: request.expectedOutcome,
    nextStep: request.nextStep,
    riskSignals,
    ownerGroups: request.ownerGroups,
    escalatedAt,
    updatedAt: escalatedAt
  });

  request.ownerGroups.forEach((ownerGroup, index) => {
    db.owner_tasks.push({
      _id: `task-${request._id}-${index + 1}`,
      requestId: request._id,
      ownerGroup,
      title: `${ownerGroup} recovery action for ${request.title}`,
      status: "open",
      dueAt,
      createdAt: escalatedAt
    });
  });

  db.customer_messages.push({
    _id: `msg-${request._id}`,
    requestId: request._id,
    body: request.customerMessage,
    customerVisible: true,
    sentAt: escalatedAt
  });

  db.audit_events.push({
    _id: `audit-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    type: "at-risk-escalation-opened",
    summary: request.expectedOutcome,
    customerVisible: true,
    recordedAt: escalatedAt
  });

  return buildPortalView(db);
}

function addHours(iso, hours) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}
