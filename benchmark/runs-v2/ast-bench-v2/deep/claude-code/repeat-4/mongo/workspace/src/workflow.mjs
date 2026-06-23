import { buildPortalView } from "./portal-view.mjs";

const OWNER_SLA_MS = 4 * 60 * 60 * 1000;

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const dueAt = new Date(new Date(now).getTime() + OWNER_SLA_MS).toISOString();

  db.workflow_state.push({
    _id: `state-${request._id}`,
    requestId: request._id,
    status: request.expectedOutcome,
    title: request.title,
    nextStep: request.nextStep,
    riskSignals: request.riskSignals.map((signal) => ({
      name: signal.name,
      detail: signal.detail
    })),
    updatedAt: now
  });

  request.ownerGroups.forEach((ownerGroup, index) => {
    db.owner_tasks.push({
      _id: `task-${request._id}-${index}`,
      requestId: request._id,
      ownerGroup,
      title: `${ownerGroup} recovery owner for ${request.title}`,
      status: "open",
      dueAt,
      createdAt: now
    });
  });

  db.customer_messages.push({
    _id: `message-${request._id}`,
    requestId: request._id,
    body: request.customerMessage,
    sentAt: now
  });

  db.audit_events.push({
    _id: `audit-${request._id}`,
    requestId: request._id,
    action: "escalation.activated",
    summary: `Escalation activated for ${request.title}; routed to ${request.ownerGroups.join(", ")}.`,
    customerVisible: true,
    occurredAt: now
  });

  return buildPortalView(db);
}
