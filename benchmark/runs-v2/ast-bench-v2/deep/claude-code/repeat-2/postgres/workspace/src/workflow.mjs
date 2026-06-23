import { buildPortalView } from "./portal-view.mjs";

const ESCALATION_STATUS =
  "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  if (!request) {
    return buildPortalView(db);
  }

  const requestId = request.request_id;
  const issuedAt = now ?? new Date().toISOString();

  // Resolve escalation routing and risk context from the normalized request tables.
  const ownerGroups = db.workflow_request_owner_groups
    .filter((row) => row.request_id === requestId)
    .slice()
    .sort((a, b) => a.group_order - b.group_order);

  const riskSignals = db.workflow_request_risk_signals
    .filter((row) => row.request_id === requestId)
    .slice()
    .sort((a, b) => a.signal_order - b.signal_order);

  // Persist the at-risk escalation workflow state.
  upsert(db.workflow_state, (row) => row.request_id === requestId, {
    request_id: requestId,
    task_id: request.task_id,
    account_id: request.account_id,
    status: ESCALATION_STATUS,
    title: request.title,
    next_step: request.next_step,
    risk_signal_count: riskSignals.length,
    updated_at: issuedAt
  });

  // Route one recovery owner task per escalation owner group, in routing order.
  removeWhere(db.owner_tasks, (row) => row.request_id === requestId);
  ownerGroups.forEach((group, index) => {
    db.owner_tasks.push({
      request_id: requestId,
      owner_group: group.owner_group,
      title: `${group.owner_group} recovery owner for ${request.title}`,
      due_at: addHours(issuedAt, (index + 1) * 4),
      status: "open"
    });
  });

  // Publish the customer-safe portal message.
  upsert(db.customer_messages, (row) => row.request_id === requestId, {
    request_id: requestId,
    body: request.customer_message,
    visibility: "customer",
    created_at: issuedAt
  });

  // Preserve a customer-visible audit event on the escalation timeline.
  db.audit_events.push({
    request_id: requestId,
    event: "at_risk_escalation_activated",
    detail: `${ownerGroups.map((group) => group.owner_group).join(", ")} routed; ${riskSignals.length} risk signals captured.`,
    customer_visible: true,
    occurred_at: issuedAt
  });

  return buildPortalView(db);
}

function upsert(rows, match, value) {
  const index = rows.findIndex(match);
  if (index >= 0) {
    rows[index] = value;
  } else {
    rows.push(value);
  }
}

function removeWhere(rows, match) {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (match(rows[i])) {
      rows.splice(i, 1);
    }
  }
}

function addHours(iso, hours) {
  const base = new Date(iso);
  if (Number.isNaN(base.getTime())) {
    return iso;
  }
  return new Date(base.getTime() + hours * 3600 * 1000).toISOString();
}
