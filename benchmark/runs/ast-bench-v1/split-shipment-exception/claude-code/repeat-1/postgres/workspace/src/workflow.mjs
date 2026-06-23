import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const requestId = request.request_id;

  const ownerGroups = db.workflow_request_owner_groups
    .filter((item) => item.request_id === requestId)
    .sort((a, b) => a.group_order - b.group_order);

  const dueAt = now || new Date().toISOString();

  db.workflow_state.push({
    request_id: requestId,
    title: request.title,
    status: request.expected_outcome,
    next_step: request.next_step
  });

  for (const group of ownerGroups) {
    db.owner_tasks.push({
      request_id: requestId,
      owner_group: group.owner_group,
      title: `${group.owner_group} review: ${request.title}`,
      due_at: dueAt,
      status: "open"
    });
  }

  db.customer_messages.push({
    request_id: requestId,
    body: request.customer_message,
    created_at: dueAt
  });

  db.audit_events.push({
    request_id: requestId,
    event: "split-shipment-exception-active",
    customer_visible: true,
    occurred_at: dueAt
  });

  return buildPortalView(db);
}
