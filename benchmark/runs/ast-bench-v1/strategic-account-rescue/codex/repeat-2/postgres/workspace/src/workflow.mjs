import { buildPortalView } from "./portal-view.mjs";

const CUSTOMER_STATUS = "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  if (!request) {
    return buildPortalView(db);
  }

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
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));

  db.workflow_state.push({
    request_id: request.request_id,
    status: CUSTOMER_STATUS,
    title: request.title,
    next_step: request.next_step,
    customer_visible: true,
    account_tier: account?.tier || null,
    support_plan: contract?.support_plan || null,
    owner_routing: ownerGroups.map((item) => item.owner_group).join(" + "),
    risk_signal_count: signals.length,
    contact_roles: contacts.map((item) => item.role).join(", "),
    created_at: now,
    updated_at: now
  });

  ownerGroups.forEach((group, index) => {
    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group: group.owner_group,
      group_order: group.group_order,
      title: buildOwnerTaskTitle(group.owner_group, account, contract),
      due_at: shiftIso(now, 30 + index * 30),
      status: "open",
      created_at: now
    });
  });

  db.customer_messages.push({
    request_id: request.request_id,
    body: buildCustomerMessage(request, account, contract),
    customer_visible: true,
    channel: "portal",
    created_at: now
  });

  for (const activity of activities) {
    db.audit_events.push({
      request_id: request.request_id,
      activity_id: activity.activity_id,
      event_type: "audit_timeline_entry",
      summary: activity.summary,
      occurred_at: activity.occurred_at,
      customer_visible: true
    });
  }

  db.audit_events.push({
    request_id: request.request_id,
    event_type: "customer-visible-audit-history",
    summary: CUSTOMER_STATUS,
    occurred_at: now,
    customer_visible: true
  });

  return buildPortalView(db);
}

function buildOwnerTaskTitle(ownerGroup, account, contract) {
  const tier = account?.tier || "account";
  const supportPlan = contract?.support_plan || "support";

  switch (ownerGroup) {
    case "Customer Success":
      return `Customer Success recovery plan for ${tier} ${supportPlan} account`;
    case "Support":
      return "Support investigation for delayed high-value order";
    case "Finance":
      return `Finance review for ${tier} account billing and contract exposure`;
    case "Executive Sponsor":
      return `Executive recovery oversight for ${tier} account`;
    default:
      return `${ownerGroup} recovery task`;
  }
}

function buildCustomerMessage(request, account, contract) {
  const tier = account?.tier || "customer";
  const supportPlan = contract?.support_plan || "support";

  return `${request.customer_message} Customer-safe portal updates remain active for the ${tier} account on ${supportPlan} support, with audit-visible history preserved.`;
}

function shiftIso(baseIso, minutes) {
  const date = new Date(baseIso);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}
