import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const ownerGroups = request.owner_groups ? String(request.owner_groups).split("|") : [];

  db.workflow_state.push({
    request_id: request.request_id,
    title: request.title,
    status: request.expected_outcome,
    next_step: request.next_step
  });

  for (const ownerGroup of ownerGroups) {
    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group: ownerGroup,
      title: `${ownerGroup} owner action for ${request.title}`,
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
    event: `Escalation activated and routed to ${ownerGroups.join(", ")}`,
    customer_visible: true,
    occurred_at: now
  });

  return buildPortalView(db);
}
