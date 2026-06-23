import { buildPortalView } from "./portal-view.mjs";

const RECOVERY_SLA_HOURS = 4;

// Activate the at-risk escalation for the strategic account: persist workflow
// state, route a recovery owner per group, publish a customer-safe message, and
// record a customer-visible audit event. Documents stay in their native shape,
// linked to the request by `requestId`.
export function applyBenchmarkTask(db, now = new Date().toISOString()) {
  const request = db.workflow_requests[0];
  if (!request) {
    return buildPortalView(db);
  }

  const requestId = request._id;
  const dueAt = new Date(new Date(now).getTime() + RECOVERY_SLA_HOURS * 60 * 60 * 1000).toISOString();

  // One escalation state per request; a re-run supersedes the prior projection.
  db.workflow_state = db.workflow_state.filter((item) => item.requestId !== requestId);
  db.workflow_state.push({
    _id: `state-${requestId}`,
    requestId,
    taskId: request.taskId,
    accountId: request.accountId,
    title: request.title,
    status: request.expectedOutcome,
    ownerGroups: request.ownerGroups,
    riskSignals: request.riskSignals,
    nextStep: request.nextStep,
    updatedAt: now
  });

  // Route one recovery owner task per group, preserving the escalation order.
  db.owner_tasks = db.owner_tasks.filter((item) => item.requestId !== requestId);
  request.ownerGroups.forEach((ownerGroup, index) => {
    db.owner_tasks.push({
      _id: `task-${requestId}-${index + 1}`,
      requestId,
      accountId: request.accountId,
      ownerGroup,
      title: `${ownerGroup} recovery owner for ${request.title}`,
      dueAt,
      status: "open",
      createdAt: now
    });
  });

  // Customer-safe portal message.
  db.customer_messages = db.customer_messages.filter((item) => item.requestId !== requestId);
  db.customer_messages.push({
    _id: `msg-${requestId}`,
    requestId,
    accountId: request.accountId,
    audience: "customer",
    channel: "portal",
    body: request.customerMessage,
    createdAt: now
  });

  // Append a customer-visible audit event so the timeline is preserved.
  db.audit_events.push({
    _id: `audit-${requestId}-${db.audit_events.length + 1}`,
    requestId,
    accountId: request.accountId,
    actor: "escalation-workflow",
    action: "at-risk-escalation.activated",
    summary: request.expectedOutcome,
    riskSignals: request.riskSignals.map((signal) => signal.name),
    ownerGroups: request.ownerGroups,
    customerVisible: true,
    occurredAt: now
  });

  return buildPortalView(db);
}
