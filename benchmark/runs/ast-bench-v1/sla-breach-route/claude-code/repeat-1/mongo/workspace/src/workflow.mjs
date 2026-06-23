import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const startedAt = new Date(now);
  const dueAt = new Date(startedAt.getTime() + 4 * 60 * 60 * 1000).toISOString();

  db.workflow_state.push({
    requestId: request._id,
    status: request.expectedOutcome,
    nextStep: request.nextStep,
    riskSignals: request.riskSignals,
    title: request.title
  });

  for (const ownerGroup of request.ownerGroups) {
    db.owner_tasks.push({
      requestId: request._id,
      ownerGroup,
      title: `${ownerGroup} review for ${request.title}`,
      dueAt,
      status: "open"
    });
  }

  db.customer_messages.push({
    requestId: request._id,
    body: request.customerMessage
  });

  db.audit_events.push({
    requestId: request._id,
    customerVisible: true,
    at: startedAt.toISOString(),
    description: `SLA response timer started for ${request.title}; escalation routed to ${request.ownerGroups.join(", ")}.`
  });

  return buildPortalView(db);
}
