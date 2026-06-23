import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const status = "Split-shipment exception active with replacement plan, owners, customer message, and audit trail.";

  db.workflow_state.push({
    requestId: request._id,
    title: request.title,
    status,
    nextStep: request.nextStep,
    riskSignals: request.riskSignals,
    updatedAt: now
  });

  for (const group of request.ownerGroups) {
    db.owner_tasks.push({
      requestId: request._id,
      ownerGroup: group,
      title: `${group} owner task for ${request.title}`,
      dueAt: now,
      status: "open"
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
    event: "split-shipment-exception.activated",
    message: `Split-shipment exception activated for ${request.title}`,
    occurredAt: now
  });

  return buildPortalView(db);
}
