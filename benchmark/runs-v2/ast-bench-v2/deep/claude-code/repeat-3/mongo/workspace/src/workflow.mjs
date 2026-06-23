import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];

  // Persist one workflow state carrying the customer-facing status, the
  // resolved next step, and the scored risk signals (names preserved in order).
  db.workflow_state.push({
    requestId: request._id,
    title: request.title,
    status: request.expectedOutcome,
    nextStep: request.nextStep,
    riskSignals: request.riskSignals.map((signal) => ({
      name: signal.name,
      detail: signal.detail
    })),
    updatedAt: now
  });

  // Route one open owner task per owner group, in the request's order.
  // dueAt is a concrete deadline derived from the workflow run time.
  const dueAt = new Date(new Date(now).getTime() + 4 * 60 * 60 * 1000).toISOString();
  for (const ownerGroup of request.ownerGroups) {
    db.owner_tasks.push({
      requestId: request._id,
      ownerGroup,
      title: `${ownerGroup}: ${request.title}`,
      dueAt,
      status: "open",
      createdAt: now
    });
  }

  // Persist the customer-safe message shown in the portal.
  db.customer_messages.push({
    requestId: request._id,
    body: request.customerMessage,
    sentAt: now
  });

  // Preserve a customer-visible audit event so the portal history is auditable.
  db.audit_events.push({
    requestId: request._id,
    action: "escalation-activated",
    customerVisible: true,
    occurredAt: now
  });

  return buildPortalView(db);
}
