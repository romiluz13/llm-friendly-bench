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
  const riskSignals = db.workflow_request_risk_signals
    .filter((item) => item.request_id === request.request_id)
    .sort((a, b) => a.signal_order - b.signal_order);
  const activities = db.activities
    .filter((item) => item.subject_id === request.request_id)
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));

  const ownerRouting = ownerGroups.map((item) => item.owner_group).join(" + ");
  const customerRouting = ownerGroups.map((item) => item.owner_group).join(", ");
  const recoveryOwner = ownerGroups[ownerGroups.length - 1]?.owner_group || null;

  db.workflow_state.push({
    request_id: request.request_id,
    account_id: request.account_id,
    title: request.title,
    status: request.expected_outcome,
    next_step: request.next_step,
    account_tier: account?.tier || null,
    support_plan: contract?.support_plan || null,
    arr_cents: contract?.arr_cents || null,
    owner_routing: ownerRouting,
    recovery_owner: recoveryOwner,
    risk_signal_count: riskSignals.length,
    contact_roles: contacts.map((item) => item.role).join(", "),
    customer_visible: true,
    created_at: now,
    updated_at: now
  });

  ownerGroups.forEach((group, index) => {
    db.owner_tasks.push({
      request_id: request.request_id,
      account_id: request.account_id,
      owner_group: group.owner_group,
      group_order: group.group_order,
      title: buildOwnerTaskTitle(group.owner_group, request.title, account, contract),
      due_at: shiftIso(now, 4 * (index + 1)),
      status: "open",
      created_at: now
    });
  });

  db.customer_messages.push({
    request_id: request.request_id,
    account_id: request.account_id,
    body: buildCustomerMessage(request, account, customerRouting),
    customer_visible: true,
    channel: "portal",
    created_at: now
  });

  for (const activity of activities) {
    db.audit_events.push({
      request_id: request.request_id,
      account_id: request.account_id,
      subject_id: request.request_id,
      activity_id: activity.activity_id,
      event_type: "audit_timeline_entry",
      summary: activity.summary,
      occurred_at: activity.occurred_at,
      customer_visible: false
    });
  }

  db.audit_events.push({
    request_id: request.request_id,
    account_id: request.account_id,
    subject_id: request.request_id,
    event_type: "customer-visible-status",
    summary: CUSTOMER_STATUS,
    owner_routing: ownerRouting,
    risk_signals: riskSignals.map((item) => item.signal_name).join(", "),
    customer_visible: true,
    occurred_at: now
  });

  return buildPortalView(db);
}

function buildOwnerTaskTitle(ownerGroup, title, account, contract) {
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
      return `${ownerGroup} recovery task for ${title}`;
  }
}

function buildCustomerMessage(request, account, ownerRouting) {
  const tier = account?.tier ? `${account.tier} ` : "";
  const accountName = account?.name || request.account_id;

  return `Your ${tier}account "${accountName}" has an active escalation routed to ${ownerRouting}. ${request.next_step}.`;
}

function shiftIso(baseIso, hours) {
  const date = new Date(baseIso);
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString();
}
