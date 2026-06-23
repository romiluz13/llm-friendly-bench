import { buildPortalView } from "./portal-view.mjs";

const CUSTOMER_FACING_STATUS =
  "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

const TASK_SLA_HOURS = 4;

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const requestId = request.request_id;

  const ownerGroups = db.workflow_request_owner_groups
    .filter((group) => group.request_id === requestId)
    .sort((a, b) => a.group_order - b.group_order);

  const riskSignals = db.workflow_request_risk_signals
    .filter((signal) => signal.request_id === requestId)
    .sort((a, b) => a.signal_order - b.signal_order);

  // Idempotency: drop any rows previously written for this request so a second
  // run produces the same persisted state instead of duplicating it.
  clearForRequest(db, "workflow_state", requestId);
  clearForRequest(db, "owner_tasks", requestId);
  clearForRequest(db, "customer_messages", requestId);
  clearForRequest(db, "audit_events", requestId);

  const dueAt = addHours(now, TASK_SLA_HOURS);
  const riskSummary = riskSignals.map((signal) => signal.signal_name).join(", ");

  db.workflow_state.push({
    request_id: requestId,
    title: request.title,
    status: CUSTOMER_FACING_STATUS,
    next_step: `Escalate to ${ownerGroups
      .map((group) => group.owner_group)
      .join(", ")} and confirm recovery plan by ${dueAt}.`,
    updated_at: now
  });

  for (const group of ownerGroups) {
    db.owner_tasks.push({
      request_id: requestId,
      owner_group: group.owner_group,
      title: `${group.owner_group}: drive strategic account rescue for ${request.title}`,
      status: "open",
      due_at: dueAt,
      created_at: now
    });
  }

  db.customer_messages.push({
    request_id: requestId,
    body: `Your escalation is active. Our ${ownerGroups
      .map((group) => group.owner_group)
      .join(", ")} teams are coordinating a recovery plan and will follow up by ${dueAt}.`,
    created_at: now
  });

  db.audit_events.push({
    request_id: requestId,
    event: "strategic_account_rescue_escalated",
    description: `Escalation activated; routed to ${ownerGroups
      .map((group) => group.owner_group)
      .join(", ")}. Risk signals: ${riskSummary}.`,
    customer_visible: true,
    occurred_at: now
  });

  return buildPortalView(db);
}

function clearForRequest(db, tableName, requestId) {
  const rows = db[tableName];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].request_id === requestId) {
      rows.splice(i, 1);
    }
  }
}

function addHours(isoTimestamp, hours) {
  return new Date(new Date(isoTimestamp).getTime() + hours * 60 * 60 * 1000).toISOString();
}
