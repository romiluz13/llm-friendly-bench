import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];

  const ownerGroups = db.workflow_request_owner_groups
    .filter((group) => group.request_id === request.request_id)
    .sort((a, b) => a.group_order - b.group_order);

  db.workflow_state.push({
    request_id: request.request_id,
    title: request.title,
    status: request.expected_outcome,
    next_step: request.next_step
  });

  for (const group of ownerGroups) {
    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group: group.owner_group,
      title: `${group.owner_group} recovery owner task: ${request.title}`,
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
    event: "escalation_opened",
    occurred_at: now,
    customer_visible: true
  });

  return buildPortalView(db);
}
