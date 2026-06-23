import { buildPortalView } from "./portal-view.mjs";

// SLA window applied to each owner task, measured from the run timestamp.
const OWNER_TASK_SLA_HOURS = 4;

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];

  // Reconstruct account context by walking the normalized foreign keys.
  const account = db.accounts.find((item) => item.account_id === request.account_id);
  const contract = db.account_contracts.find((item) => item.account_id === request.account_id);
  const contacts = db.contacts.filter((item) => item.account_id === request.account_id);
  const activities = db.activities
    .filter((item) => item.subject_id === request.request_id)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  // Resolve the ordered owner groups for this request.
  const ownerGroups = db.workflow_request_owner_groups
    .filter((item) => item.request_id === request.request_id)
    .sort((a, b) => a.group_order - b.group_order)
    .map((item) => item.owner_group);

  // Resolve the ordered risk signals for this request.
  const riskSignals = db.workflow_request_risk_signals
    .filter((item) => item.request_id === request.request_id)
    .sort((a, b) => a.signal_order - b.signal_order)
    .map((item) => ({ name: item.signal_name, detail: item.detail }));

  // Customer-safe next step routed to the lead owner group.
  const leadOwner = ownerGroups[0];
  const nextStep = `${leadOwner} owner review and escalation within ${OWNER_TASK_SLA_HOURS}h SLA window`;

  // Timer audit: when the breach was first observed vs. when we escalated.
  const breachObservedAt = activities[0]?.occurred_at ?? now;
  const timerDetail =
    `Timer audit: SLA breach observed ${breachObservedAt}, escalated ${now} ` +
    `to ${ownerGroups.join(", ")}.`;

  // Persist one workflow state row keyed by request_id.
  db.workflow_state.push({
    request_id: request.request_id,
    account_id: request.account_id,
    title: request.title,
    status: request.expected_outcome,
    next_step: nextStep,
    owner_groups: ownerGroups,
    signal_count: riskSignals.length,
    account_tier: account?.tier ?? null,
    support_plan: contract?.support_plan ?? null,
    timer_audit: timerDetail,
    created_at: now
  });

  // Persist one owner task per owner group, in group_order order.
  const dueAt = new Date(Date.parse(now) + OWNER_TASK_SLA_HOURS * 60 * 60 * 1000).toISOString();
  for (const ownerGroup of ownerGroups) {
    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group: ownerGroup,
      title: `${ownerGroup}: action SLA breach route for ${account?.name ?? request.account_id}`,
      due_at: dueAt,
      status: "open",
      created_at: now
    });
  }

  // Persist one customer-safe message.
  db.customer_messages.push({
    request_id: request.request_id,
    channel: "portal",
    body: `Your SLA breach has been escalated to ${ownerGroups.join(", ")}. ${nextStep}.`,
    created_at: now
  });

  // Persist one customer-visible audit event carrying the timer audit.
  db.audit_events.push({
    request_id: request.request_id,
    event_type: "sla_breach_escalated",
    detail: timerDetail,
    customer_visible: true,
    created_at: now
  });

  // Render the portal projection from the freshly persisted state.
  return buildPortalView(db);
}
