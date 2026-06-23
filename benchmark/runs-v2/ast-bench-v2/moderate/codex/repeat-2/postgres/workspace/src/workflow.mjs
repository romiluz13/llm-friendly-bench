import { buildPortalView } from "./portal-view.mjs";

const EXPECTED_STATUS = "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item.account_id === request.account_id);
  const contract = db.account_contracts.find((item) => item.account_id === request.account_id);
  const contacts = db.contacts.filter((item) => item.account_id === request.account_id);
  const ownerGroups = db.workflow_request_owner_groups
    .filter((item) => item.request_id === request.request_id)
    .sort((a, b) => a.group_order - b.group_order);
  const signals = db.workflow_request_risk_signals
    .filter((item) => item.request_id === request.request_id)
    .sort((a, b) => a.signal_order - b.signal_order);
  const activities = db.activities
    .filter((item) => item.subject_id === request.request_id)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const ownerRouting = ownerGroups.map((item) => item.owner_group).join(" + ");
  const auditTimeline = activities.map((item) => `${item.occurred_at} ${item.summary}`).join(" | ");
  const dueAt = shiftHours(now, 4);

  upsertRows(db.workflow_state, (item) => item.request_id !== request.request_id, [{
    request_id: request.request_id,
    account_id: request.account_id,
    title: request.title,
    status: EXPECTED_STATUS,
    next_step: request.next_step,
    customer_message: request.customer_message,
    expected_outcome: request.expected_outcome,
    owner_routing: ownerRouting,
    account_name: account?.name,
    account_tier: account?.tier,
    contract_support_plan: contract?.support_plan,
    contract_arr_cents: contract?.arr_cents,
    contract_renewal_date: contract?.renewal_date,
    contact_roles: contacts.map((item) => item.role).join(", "),
    risk_signal_count: signals.length,
    risk_signal_names: signals.map((item) => item.signal_name).join(", "),
    audit_activity_count: activities.length,
    audit_timeline: auditTimeline,
    updated_at: now
  }]);

  upsertRows(db.owner_tasks, (item) => item.request_id !== request.request_id, ownerGroups.map((group) => ({
    request_id: request.request_id,
    account_id: request.account_id,
    owner_group: group.owner_group,
    group_order: group.group_order,
    title: taskTitleFor(group.owner_group),
    status: "open",
    due_at: dueAt,
    created_at: now
  })));

  upsertRows(db.customer_messages, (item) => item.request_id !== request.request_id, [{
    request_id: request.request_id,
    account_id: request.account_id,
    body: request.customer_message,
    audience: "customer",
    customer_visible: true,
    created_at: now
  }]);

  upsertRows(db.audit_events, (item) => item.request_id !== request.request_id, [{
    request_id: request.request_id,
    account_id: request.account_id,
    event_type: "customer-visible-escalation",
    summary: EXPECTED_STATUS,
    detail: auditTimeline || request.customer_message,
    customer_visible: true,
    created_at: now
  }]);

  return buildPortalView(db);
}

function upsertRows(table, keepPredicate, rows) {
  const nextRows = table.filter(keepPredicate);
  table.splice(0, table.length, ...nextRows, ...rows);
}

function shiftHours(iso, hours) {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) {
    return iso;
  }

  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString();
}

function taskTitleFor(ownerGroup) {
  switch (ownerGroup) {
    case "Customer Success":
      return "Coordinate customer recovery plan";
    case "Support":
      return "Monitor order delay and support impact";
    case "Finance":
      return "Validate billing and invoice exposure";
    case "Executive Sponsor":
      return "Lead executive recovery review";
    default:
      return `${ownerGroup} escalation follow-up`;
  }
}
