import { buildPortalView } from "./portal-view.mjs";

const CUSTOMER_VISIBLE_STATUS =
  "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

export function applyBenchmarkTask(db, now) {
  const request = requireOne(db.workflow_requests, (item) => item.task_id === "strategic-account-rescue", "workflow request");
  const account = requireOne(db.accounts, (item) => item.account_id === request.account_id, "account");
  const contract = requireOne(db.account_contracts, (item) => item.account_id === request.account_id, "contract");
  const ownerGroups = db.workflow_request_owner_groups
    .filter((item) => item.request_id === request.request_id)
    .slice()
    .sort((a, b) => a.group_order - b.group_order);
  const riskSignals = db.workflow_request_risk_signals
    .filter((item) => item.request_id === request.request_id)
    .slice()
    .sort((a, b) => a.signal_order - b.signal_order);
  const activities = db.activities
    .filter((item) => item.account_id === request.account_id || item.subject_id === request.request_id)
    .slice()
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const timestamp = toIsoTimestamp(now);
  const ownerRouting = ownerGroups.map((item) => item.owner_group).join(" + ");
  const riskSummary = riskSignals.map((item) => item.signal_name).join(", ");
  const activityTimeline = activities.map((item) => `${item.occurred_at} ${item.summary}`).join(" | ");
  const customerMessage = request.customer_message;

  upsertRows(
    db.workflow_state,
    (item) => item.request_id === request.request_id,
    [
      {
        request_id: request.request_id,
        task_id: request.task_id,
        account_id: request.account_id,
        title: request.title,
        status: CUSTOMER_VISIBLE_STATUS,
        next_step: request.next_step,
        customer_visible_audit_history: true,
        account_name: account.name,
        account_tier: account.tier,
        support_plan: contract.support_plan,
        renewal_date: contract.renewal_date,
        arr_cents: contract.arr_cents,
        owner_routing: ownerRouting,
        risk_signal_count: riskSignals.length,
        risk_signal_summary: riskSummary,
        activity_count: activities.length,
        activity_first_at: activities[0]?.occurred_at ?? null,
        activity_last_at: activities.at(-1)?.occurred_at ?? null,
        customer_message: customerMessage,
        updated_at: timestamp
      }
    ]
  );

  upsertRows(
    db.owner_tasks,
    (item) => item.request_id === request.request_id,
    ownerGroups.map((group) => ({
      task_id: `${request.request_id}-${slug(group.owner_group)}-${String(group.group_order).padStart(2, "0")}`,
      request_id: request.request_id,
      account_id: request.account_id,
      owner_group: group.owner_group,
      group_order: group.group_order,
      title: ownerTaskTitle(group.owner_group),
      detail: ownerTaskDetail(group.owner_group, account, contract, riskSignals.length, activities.length),
      due_at: dueAtForGroup(now, group.group_order),
      status: "open",
      created_at: timestamp,
      updated_at: timestamp
    }))
  );

  upsertRows(
    db.customer_messages,
    (item) => item.request_id === request.request_id,
    [
      {
        message_id: `${request.request_id}-customer-message`,
        request_id: request.request_id,
        account_id: request.account_id,
        body: customerMessage,
        customer_visible: true,
        channel: "portal",
        created_at: timestamp,
        updated_at: timestamp
      }
    ]
  );

  upsertRows(
    db.audit_events,
    (item) => item.request_id === request.request_id,
    [
      {
        audit_event_id: `${request.request_id}-escalation-activated`,
        request_id: request.request_id,
        account_id: request.account_id,
        event_type: "workflow.escalation.activated",
        customer_visible: true,
        summary: CUSTOMER_VISIBLE_STATUS,
        detail: `Escalation opened for ${account.name} (${account.tier}, ${contract.support_plan} support). Owner routing: ${ownerRouting}. Risk signals: ${riskSummary}. Activity trail: ${activityTimeline}.`,
        occurred_at: timestamp,
        created_at: timestamp
      }
    ]
  );

  return buildPortalView(db);
}

function requireOne(rows, predicate, label) {
  const match = rows.find(predicate);
  if (!match) {
    throw new Error(`Missing ${label}`);
  }
  return match;
}

function upsertRows(rows, predicate, nextRows) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (predicate(rows[index])) {
      rows.splice(index, 1);
    }
  }
  rows.push(...nextRows);
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ownerTaskTitle(ownerGroup) {
  switch (ownerGroup) {
    case "Customer Success":
      return "Customer Success recovery coordination";
    case "Support":
      return "Support incident and shipment triage";
    case "Finance":
      return "Finance contract and billing review";
    case "Executive Sponsor":
      return "Executive Sponsor recovery oversight";
    default:
      return `${ownerGroup} recovery coordination`;
  }
}

function ownerTaskDetail(ownerGroup, account, contract, riskSignalCount, activityCount) {
  switch (ownerGroup) {
    case "Customer Success":
      return `Coordinate the ${account.tier} recovery plan and keep the customer-safe portal update aligned with ${contract.support_plan} support.`;
    case "Support":
      return `Triage the delayed order impact, service restoration work, and the ${riskSignalCount}-signal escalation path.`;
    case "Finance":
      return `Review contract exposure, billing posture, and commercial exceptions for the ${contract.support_plan} account.`;
    case "Executive Sponsor":
      return `Maintain executive recovery oversight across ${activityCount} timeline updates and keep the audit trail customer-safe.`;
    default:
      return `Own the recovery workstream for the ${account.tier} account under ${contract.support_plan} support.`;
  }
}

function dueAtForGroup(now, groupOrder) {
  const offsetsInHours = [4, 8, 24, 36];
  const offset = offsetsInHours[groupOrder - 1] ?? groupOrder * 12;
  return new Date(Date.parse(now) + offset * 60 * 60 * 1000).toISOString();
}

function toIsoTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid workflow timestamp");
  }
  return date.toISOString();
}
