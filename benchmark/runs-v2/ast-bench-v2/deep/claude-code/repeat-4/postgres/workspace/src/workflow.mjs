import { buildPortalView } from "./portal-view.mjs";

const ESCALATION_WINDOW_HOURS = 4;

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];

  // Idempotent: once an account is escalated, re-running only re-projects the portal.
  if (db.workflow_state.some((row) => row.request_id === request.request_id)) {
    return buildPortalView(db);
  }

  const ownerGroups = db.workflow_request_owner_groups
    .filter((row) => row.request_id === request.request_id)
    .sort((a, b) => a.group_order - b.group_order);

  const riskSignals = db.workflow_request_risk_signals
    .filter((row) => row.request_id === request.request_id)
    .sort((a, b) => a.signal_order - b.signal_order);

  const dueAt = addHours(now, ESCALATION_WINDOW_HOURS);

  // Workflow state row: the customer-facing escalation status and recovery routing.
  db.workflow_state.push({
    request_id: request.request_id,
    status: request.expected_outcome,
    title: request.title,
    next_step: request.next_step,
    risk_score: riskSignals.length,
    updated_at: now
  });

  // Route one recovery owner task per group, preserving escalation order.
  for (const group of ownerGroups) {
    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group: group.owner_group,
      title: `${group.owner_group} recovery owner for ${request.title}`,
      due_at: dueAt,
      status: "open",
      created_at: now
    });
  }

  // Customer-safe message surfaced in the portal.
  db.customer_messages.push({
    request_id: request.request_id,
    body: request.customer_message,
    sent_at: now,
    customer_visible: true
  });

  // Customer-visible audit timeline entry recording the escalation.
  db.audit_events.push({
    request_id: request.request_id,
    event: "at_risk_escalation_activated",
    detail: `${request.title}: ${riskSignals.map((signal) => signal.signal_name).join(", ")}`,
    customer_visible: true,
    occurred_at: now
  });

  return buildPortalView(db);
}

function addHours(iso, hours) {
  const at = new Date(iso);
  at.setUTCHours(at.getUTCHours() + hours);
  return at.toISOString();
}
