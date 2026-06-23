import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];

  db.workflow_state.push({
    request_id: request.request_id,
    account_id: request.account_id,
    title: request.title,
    status: request.expected_outcome,
    next_step: request.next_step,
    updated_at: now
  });

  for (const owner_group of request.owner_groups.split("|")) {
    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group,
      title: `${owner_group} — ${request.title}`,
      due_at: now,
      status: "open"
    });
  }

  db.customer_messages.push({
    request_id: request.request_id,
    body: request.customer_message,
    sent_at: now
  });

  db.audit_events.push({
    request_id: request.request_id,
    event: "escalation_activated",
    detail: request.expected_outcome,
    customer_visible: true,
    created_at: now
  });

  return buildPortalView(db);
}
