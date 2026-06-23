import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];

  db.workflow_state.push({
    _id: `state-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    status: request.expectedOutcome,
    title: request.title,
    nextStep: request.nextStep,
    riskSignals: request.riskSignals.map((signal) => ({ ...signal })),
    createdAt: now,
    updatedAt: now
  });

  request.ownerGroups.forEach((ownerGroup, index) => {
    db.owner_tasks.push({
      _id: `task-${request._id}-${index}`,
      requestId: request._id,
      accountId: request.accountId,
      ownerGroup,
      title: `${ownerGroup}: ${request.title}`,
      status: "open",
      dueAt: new Date(Date.parse(now) + (index + 1) * 60 * 60 * 1000).toISOString(),
      createdAt: now
    });
  });

  db.customer_messages.push({
    _id: `msg-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    channel: "portal",
    body: request.customerMessage,
    customerVisible: true,
    createdAt: now
  });

  db.audit_events.push({
    _id: `audit-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    event: "invoice-dispute.activated",
    actor: "workflow-engine",
    message: `Activated workflow "${request.title}" with owners ${request.ownerGroups.join(", ")}.`,
    customerVisible: true,
    occurredAt: now,
    createdAt: now
  });

  return buildPortalView(db);
}
