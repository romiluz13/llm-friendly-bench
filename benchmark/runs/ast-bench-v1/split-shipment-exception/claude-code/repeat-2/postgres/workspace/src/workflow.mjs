import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];

  const ownerGroups = db.workflow_request_owner_groups
    .filter((item) => item.request_id === request.request_id)
    .sort((a, b) => a.group_order - b.group_order);

  const signals = db.workflow_request_risk_signals
    .filter((item) => item.request_id === request.request_id)
    .sort((a, b) => a.signal_order - b.signal_order);

  // Replacement-plan deadline: same business day, end of afternoon review window.
  const dueAt = new Date(new Date(now).getTime() + 4 * 60 * 60 * 1000).toISOString();

  db.workflow_state.push({
    request_id: request.request_id,
    title: request.title,
    status: request.expected_outcome,
    next_step: request.next_step,
    risk_signal_count: signals.length,
    updated_at: now
  });

  for (const group of ownerGroups) {
    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group: group.owner_group,
      title: `${group.owner_group} action for ${request.title}`,
      status: "open",
      due_at: dueAt,
      created_at: now
    });
  }

  db.customer_messages.push({
    request_id: request.request_id,
    body: request.customer_message,
    created_at: now
  });

  db.audit_events.push({
    request_id: request.request_id,
    event: "split_shipment_exception_activated",
    detail: `Routed to ${ownerGroups.map((group) => group.owner_group).join(", ")} with ${signals.length} risk signals.`,
    customer_visible: true,
    occurred_at: now
  });

  return buildPortalView(db);
}
