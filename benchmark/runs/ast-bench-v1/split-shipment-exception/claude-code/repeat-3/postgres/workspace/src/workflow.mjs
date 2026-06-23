import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];

  const ownerGroups = db.workflow_request_owner_groups
    .filter((group) => group.request_id === request.request_id)
    .sort((a, b) => a.group_order - b.group_order);

  const signals = db.workflow_request_risk_signals
    .filter((signal) => signal.request_id === request.request_id)
    .sort((a, b) => a.signal_order - b.signal_order);

  // Reconcile the exception into a single workflow_state row.
  db.workflow_state.push({
    request_id: request.request_id,
    title: request.title,
    status: request.expected_outcome,
    next_step: request.next_step,
    risk_signal_count: signals.length,
    updated_at: now
  });

  // One owner task per routed group, kept in escalation order.
  for (const group of ownerGroups) {
    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group: group.owner_group,
      title: `${group.owner_group}: resolve split-shipment exception`,
      due_at: now,
      status: "open"
    });
  }

  // One customer-safe message reusing the approved copy.
  db.customer_messages.push({
    request_id: request.request_id,
    body: request.customer_message,
    created_at: now
  });

  // One customer-visible audit event closing the trail.
  db.audit_events.push({
    request_id: request.request_id,
    event: "split_shipment_exception_activated",
    detail: `Risk signals reconciled: ${signals.map((signal) => signal.signal_name).join(", ")}`,
    customer_visible: true,
    occurred_at: now
  });

  return buildPortalView(db);
}
