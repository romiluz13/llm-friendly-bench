import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const dueAt = new Date(Date.parse(now) + 4 * 60 * 60 * 1000).toISOString();

  db.workflow_state.push({
    requestId: request._id,
    title: request.title,
    status: request.expectedOutcome,
    nextStep: request.nextStep,
    riskSignals: request.riskSignals,
    updatedAt: now
  });

  for (const ownerGroup of request.ownerGroups) {
    db.owner_tasks.push({
      requestId: request._id,
      ownerGroup,
      title: `${ownerGroup} recovery action for ${request.title}`,
      dueAt,
      status: "open",
      createdAt: now
    });
  }

  db.customer_messages.push({
    requestId: request._id,
    body: request.customerMessage,
    createdAt: now
  });

  db.audit_events.push({
    requestId: request._id,
    customerVisible: true,
    type: "at-risk-escalation",
    summary: `At-risk escalation opened for ${request.title}`,
    at: now
  });

  return buildPortalView(db);
}
