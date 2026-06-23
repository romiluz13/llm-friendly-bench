import { buildPortalView } from "./portal-view.mjs";

// Entitlement-driven response timer: tighter SLA windows for higher support plans.
const SLA_HOURS_BY_PLAN = { platinum: 1, gold: 4, silver: 8, standard: 24 };

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item.account_id === request.account_id);
  const contract = db.account_contracts.find((item) => item.account_id === request.account_id);
  const contacts = db.contacts.filter((item) => item.account_id === request.account_id);

  const ownerGroups = db.workflow_request_owner_groups
    .filter((item) => item.request_id === request.request_id)
    .slice()
    .sort((a, b) => a.group_order - b.group_order);

  const signals = db.workflow_request_risk_signals
    .filter((item) => item.request_id === request.request_id)
    .slice()
    .sort((a, b) => a.signal_order - b.signal_order);

  const incidents = db.activities
    .filter((item) => item.subject_id === request.request_id)
    .slice()
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  const escalatedAt = new Date(Date.parse(now)).toISOString();
  const slaHours = SLA_HOURS_BY_PLAN[contract?.support_plan] || SLA_HOURS_BY_PLAN.standard;
  const dueAt = (offsetHours) => new Date(Date.parse(now) + offsetHours * 3600 * 1000).toISOString();

  const ownerList = ownerGroups.map((item) => item.owner_group).join(", ");
  const status = request.expected_outcome;
  const nextStep = request.next_step;

  const ownerTasks = ownerGroups.map((group) => ({
    task_id: `task-${request.request_id}-${group.group_order}`,
    request_id: request.request_id,
    owner_group: group.owner_group,
    title: `${group.owner_group}: respond to SLA breach for ${request.title}`,
    status: "open",
    due_at: dueAt(slaHours * group.group_order),
    created_at: escalatedAt
  }));

  db.workflow_state.push({
    request_id: request.request_id,
    task_id: request.task_id,
    title: request.title,
    status,
    next_step: nextStep,
    account_tier: account?.tier || "unknown",
    support_plan: contract?.support_plan || "standard",
    owner_route: ownerGroups.map((item) => item.owner_group).join(" + "),
    risk_signals: signals.map((item) => ({ name: item.signal_name, detail: item.detail })),
    open_incidents: incidents.length,
    escalated_at: escalatedAt,
    updated_at: escalatedAt
  });

  for (const task of ownerTasks) {
    db.owner_tasks.push(task);
  }

  db.customer_messages.push({
    message_id: `msg-${request.request_id}`,
    request_id: request.request_id,
    body: `Your enterprise SLA breach has been escalated to ${ownerList}. Next step: ${nextStep}. We will keep you updated as each owner responds within the agreed support window.`,
    customer_visible: true,
    sent_at: escalatedAt
  });

  db.audit_events.push({
    event_id: `audit-${request.request_id}`,
    request_id: request.request_id,
    event_type: "sla_breach_escalated",
    customer_visible: true,
    summary: `SLA breach escalated to ${ownerList}; ${signals.length} risk signals recorded against ${account?.tier || "enterprise"} account on ${contract?.support_plan || "standard"} plan.`,
    timer_audit: ownerTasks.map((task) => ({ owner_group: task.owner_group, due_at: task.due_at })),
    recorded_at: escalatedAt
  });

  return buildPortalView(db);
}
