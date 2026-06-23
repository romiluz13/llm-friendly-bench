import { buildPortalView } from "./portal-view.mjs";

const ESCALATION_STATUS = "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

export function applyBenchmarkTask(db, now) {
  const request = findRequest(db);

  if (!request) {
    return buildPortalView(db);
  }

  const account = findOne(db.accounts, (item) => item.account_id === request.account_id);
  const contract = findOne(db.account_contracts, (item) => item.account_id === request.account_id);
  const supportPlan = contract ? findOne(db.support_plans, (item) => item.contract_id === contract.contract_id) : undefined;
  const invoiceRisk = findOne(db.invoice_risk, (item) => item.account_id === request.account_id);
  const billingAddress = findOne(db.account_addresses, (item) => item.account_id === request.account_id && item.kind === "billing");
  const ownerGroups = sortedRows(db.workflow_request_owner_groups, request.request_id, "group_order");
  const signals = sortedRows(db.workflow_request_risk_signals, request.request_id, "signal_order");
  const activities = sortedRows(db.activities, request.account_id, "occurred_at", (item) => item.account_id);
  const activitySources = new Map((db.activity_sources ?? []).map((item) => [item.activity_id, item]));

  db.workflow_state = replaceRows(db.workflow_state, (item) => item.request_id === request.request_id, [{
    workflow_state_id: `${request.request_id}-workflow-state`,
    request_id: request.request_id,
    task_id: request.task_id,
    account_id: request.account_id,
    title: request.title,
    status: ESCALATION_STATUS,
    next_step: request.next_step,
    customer_visible_audit_history: true,
    account_tier: account?.tier ?? null,
    account_name: account?.name ?? null,
    account_region: account?.region ?? null,
    contract_id: contract?.contract_id ?? null,
    renewal_date: contract?.renewal_date ?? null,
    arr_cents: contract?.arr_cents ?? null,
    support_plan: supportPlan?.plan ?? contract?.support_plan ?? null,
    invoice_risk_level: invoiceRisk?.level ?? null,
    billing_region: billingAddress?.region ?? null,
    owner_groups: ownerGroups.map((item) => item.owner_group),
    risk_signals: signals.map((item) => ({
      signal_name: item.signal_name,
      detail: item.detail,
      signal_order: item.signal_order
    })),
    activity_ids: activities.map((item) => item.activity_id),
    audit_event_count: activities.length + 1,
    legal_review_required: true,
    updated_at: now
  }]);

  db.owner_tasks = replaceRows(db.owner_tasks, (item) => item.request_id === request.request_id, ownerGroups.map((group, index) => ({
    owner_task_id: `${request.request_id}-task-${String(index + 1).padStart(2, "0")}`,
    request_id: request.request_id,
    account_id: request.account_id,
    owner_group: group.owner_group,
    title: `${group.owner_group} recovery task for ${account?.name ?? request.title}`,
    due_at: offsetHours(now, index + 4),
    status: "open",
    priority: group.group_order === 1 ? "high" : "medium",
    created_at: now,
    context: {
      account_tier: account?.tier ?? null,
      contract_support_plan: contract?.support_plan ?? null,
      invoice_risk_level: invoiceRisk?.level ?? null
    }
  })));

  db.customer_messages = replaceRows(db.customer_messages, (item) => item.request_id === request.request_id, [{
    customer_message_id: `${request.request_id}-customer-message`,
    request_id: request.request_id,
    account_id: request.account_id,
    body: request.customer_message,
    audience: "customer-safe",
    status: "published",
    created_at: now
  }]);

  const timelineEvents = activities.map((activity, index) => ({
    audit_event_id: `${request.request_id}-activity-${String(index + 1).padStart(2, "0")}`,
    request_id: request.request_id,
    account_id: request.account_id,
    activity_id: activity.activity_id,
    subject_id: activity.subject_id,
    summary: activity.summary,
    occurred_at: activity.occurred_at,
    customer_visible: false,
    source: activitySources.get(activity.activity_id)?.source ?? "system"
  }));

  timelineEvents.push({
    audit_event_id: `${request.request_id}-customer-visible-escalation`,
    request_id: request.request_id,
    account_id: request.account_id,
    event_type: "customer-visible-escalation",
    summary: ESCALATION_STATUS,
    occurred_at: now,
    customer_visible: true,
    source: "workflow",
    owner_groups: ownerGroups.map((item) => item.owner_group)
  });

  db.audit_events = replaceRows(db.audit_events, (item) => item.request_id === request.request_id, timelineEvents);

  return buildPortalView(db);
}

function findRequest(db) {
  return findOne(db.workflow_requests, (item) => item.task_id === "strategic-account-rescue") ?? db.workflow_requests?.[0];
}

function findOne(rows, predicate) {
  return (rows ?? []).find(predicate);
}

function sortedRows(rows, requestValue, sortField, matchField = (item) => item.request_id) {
  return (rows ?? [])
    .filter((item) => matchField(item) === requestValue)
    .sort((left, right) => {
      const leftValue = left[sortField];
      const rightValue = right[sortField];

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return leftValue - rightValue;
      }

      return String(leftValue).localeCompare(String(rightValue));
    });
}

function replaceRows(rows, predicate, newRows) {
  return (rows ?? []).filter((item) => !predicate(item)).concat(newRows);
}

function offsetHours(iso, hours) {
  return new Date(Date.parse(iso) + hours * 60 * 60 * 1000).toISOString();
}
