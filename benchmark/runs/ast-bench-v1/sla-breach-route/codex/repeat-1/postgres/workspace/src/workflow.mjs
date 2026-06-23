import { buildPortalView } from "./portal-view.mjs";

const FINAL_STATUS = "SLA breach escalated with correct owners, customer-safe next step, and timer audit.";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests.find((item) => item.task_id === "sla-breach-route") || db.workflow_requests[0];
  const account = db.accounts.find((item) => item.account_id === request.account_id) || db.accounts[0] || {};
  const contract = db.account_contracts.find((item) => item.account_id === request.account_id) || db.account_contracts[0] || {};
  const ownerGroups = (db.workflow_request_owner_groups || [])
    .filter((item) => item.request_id === request.request_id)
    .slice()
    .sort((a, b) => Number(a.group_order) - Number(b.group_order));
  const signals = (db.workflow_request_risk_signals || [])
    .filter((item) => item.request_id === request.request_id)
    .slice()
    .sort((a, b) => Number(a.signal_order) - Number(b.signal_order));
  const activities = (db.activities || [])
    .filter((item) => item.account_id === request.account_id && item.subject_id === request.request_id)
    .slice()
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
  const customerMessageBody = request.customer_message || "SLA breach has been escalated to Support, Customer Success, Product, and Operations.";
  const dueAt = new Date(new Date(now).getTime() + 4 * 60 * 60 * 1000).toISOString();

  const workflowState = {
    request_id: request.request_id,
    task_id: request.task_id,
    account_id: request.account_id,
    title: request.title,
    status: request.expected_outcome || FINAL_STATUS,
    next_step: request.next_step || "Support owner review by 16:00",
    customer_message: customerMessageBody,
    customer_visible: true,
    entitlement: contract.support_plan || null,
    support_plan: contract.support_plan || null,
    account_tier: account.tier || null,
    account_name: account.name || null,
    region: account.region || null,
    arr_cents: contract.arr_cents || null,
    renewal_date: contract.renewal_date || null,
    owner_group_count: ownerGroups.length,
    owner_group_summary: ownerGroups.map((item) => item.owner_group).join(", "),
    risk_signal_count: signals.length,
    risk_signal_summary: signals.map((item) => item.signal_name).join(", "),
    open_activity_count: activities.length,
    latest_activity_at: activities[activities.length - 1]?.occurred_at || null,
    timer_due_at: dueAt,
    timer_audit: `Due ${dueAt}; reviewed ${activities.length} related activities and ${signals.length} risk signals.`,
    escalated_at: now,
    escalation_state: "customer-visible"
  };

  const ownerTasks = ownerGroups.map((item, index) => ({
    task_id: `${request.request_id}-${slugify(item.owner_group)}-review`,
    request_id: request.request_id,
    owner_group: item.owner_group,
    group_order: Number(item.group_order),
    title: `${item.owner_group} SLA breach review`,
    status: "open",
    due_at: dueAt,
    created_at: now,
    priority: index === 0 ? "urgent" : "high"
  }));

  const customerMessage = {
    message_id: `${request.request_id}-customer-message`,
    request_id: request.request_id,
    body: customerMessageBody,
    sent_at: now,
    channel: "customer",
    customer_visible: true,
    status: "sent"
  };

  const auditEvent = {
    audit_id: `${request.request_id}-sla-breach-audit`,
    request_id: request.request_id,
    event_type: "sla_breach_escalated",
    summary: FINAL_STATUS,
    customer_visible: true,
    occurred_at: now,
    timer_due_at: dueAt,
    owner_group_count: ownerGroups.length,
    risk_signal_count: signals.length,
    open_activity_count: activities.length,
    account_tier: account.tier || null,
    entitlement: contract.support_plan || null
  };

  db.workflow_state = upsertRequestRows(db.workflow_state, request.request_id, [workflowState]);
  db.owner_tasks = upsertRequestRows(db.owner_tasks, request.request_id, ownerTasks);
  db.customer_messages = upsertRequestRows(db.customer_messages, request.request_id, [customerMessage]);
  db.audit_events = upsertRequestRows(db.audit_events, request.request_id, [auditEvent]);

  return buildPortalView(db);
}

function upsertRequestRows(rows, requestId, nextRows) {
  const base = Array.isArray(rows) ? rows.filter((item) => item.request_id !== requestId) : [];
  return base.concat(nextRows);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
