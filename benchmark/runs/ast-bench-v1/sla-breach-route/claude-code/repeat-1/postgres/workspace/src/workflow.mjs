import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const ownerGroups = db.workflow_request_owner_groups
    .filter((item) => item.request_id === request.request_id)
    .slice()
    .sort((a, b) => a.group_order - b.group_order);
  const signals = db.workflow_request_risk_signals
    .filter((item) => item.request_id === request.request_id)
    .slice()
    .sort((a, b) => a.signal_order - b.signal_order);

  const owners = ownerGroups.map((item) => item.owner_group);
  // SLA timer: owners must respond within four hours of the breach being routed.
  const dueAt = new Date(new Date(now).getTime() + 4 * 60 * 60 * 1000).toISOString();
  const nextStep = `Your request is being escalated to ${owners.join(", ")}. The owning team will respond by ${dueAt}.`;

  db.workflow_state.push({
    request_id: request.request_id,
    status: request.expected_outcome,
    title: request.title,
    next_step: nextStep
  });

  for (const group of ownerGroups) {
    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group: group.owner_group,
      title: `Review and resolve "${request.title}" SLA breach (${group.owner_group})`,
      due_at: dueAt,
      status: "open"
    });
  }

  db.customer_messages.push({
    request_id: request.request_id,
    body: `We have escalated your SLA breach to ${owners.join(", ")} and will follow up by ${dueAt}.`
  });

  db.audit_events.push({
    request_id: request.request_id,
    event: "sla_breach_escalated",
    detail: `SLA timer started at ${now}; escalation routed to ${owners.join(", ")}; risk signals: ${signals.map((s) => s.signal_name).join(", ")}.`,
    customer_visible: true,
    created_at: now
  });

  return buildPortalView(db);
}
