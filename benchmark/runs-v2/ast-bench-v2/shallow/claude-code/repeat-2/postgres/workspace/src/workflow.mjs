import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];

  db.workflow_state.push({
    request_id: request.request_id,
    title: request.title,
    status: request.expected_outcome,
    next_step: request.next_step
  });

  for (const owner_group of request.owner_groups.split("|")) {
    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group,
      title: `${owner_group} action for ${request.title}`,
      due_at: now,
      status: "open"
    });
  }

  db.customer_messages.push({
    request_id: request.request_id,
    body: request.customer_message
  });

  db.audit_events.push({
    request_id: request.request_id,
    event_type: "workflow_escalation",
    message: request.expected_outcome,
    customer_visible: true,
    created_at: now
  });

  return buildPortalView(db);
}
