import { buildPortalView } from "./portal-view.mjs";

const ESCALATION_STATUS =
  "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];

  const ownerGroups = db.workflow_request_owner_groups
    .filter((group) => group.request_id === request.request_id)
    .sort((a, b) => a.group_order - b.group_order);

  const riskSignals = db.workflow_request_risk_signals
    .filter((signal) => signal.request_id === request.request_id)
    .sort((a, b) => a.signal_order - b.signal_order);

  // Open the at-risk escalation: one workflow_state row drives the portal projection.
  db.workflow_state.push({
    request_id: request.request_id,
    account_id: request.account_id,
    status: ESCALATION_STATUS,
    title: request.title,
    next_step: request.next_step,
    updated_at: now
  });

  // Route one recovery owner task per group, preserving the contracted group order.
  const dueAt = addHours(now, 4);
  for (const group of ownerGroups) {
    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group: group.owner_group,
      title: `${group.owner_group} recovery owner for ${request.title}`,
      status: "open",
      due_at: dueAt,
      created_at: now
    });
  }

  // Customer-safe portal message.
  db.customer_messages.push({
    request_id: request.request_id,
    body: request.customer_message,
    visibility: "customer",
    sent_at: now
  });

  // Customer-visible audit event preserving the escalation timeline.
  db.audit_events.push({
    request_id: request.request_id,
    event: "at_risk_escalation_opened",
    detail: `${riskSignals.length} risk signals routed to ${ownerGroups
      .map((group) => group.owner_group)
      .join(", ")}`,
    customer_visible: true,
    occurred_at: now
  });

  return buildPortalView(db);
}

function addHours(iso, hours) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}
