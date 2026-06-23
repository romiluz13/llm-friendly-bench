import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  if (!request) {
    return buildPortalView(db);
  }

  const requestId = request.request_id;
  const referenceTime = now || new Date().toISOString();
  const account = db.accounts.find((item) => item.account_id === request.account_id);
  const contract = db.account_contracts.find((item) => item.account_id === request.account_id);
  const ownerGroups = db.workflow_request_owner_groups
    .filter((item) => item.request_id === requestId)
    .slice()
    .sort((a, b) => a.group_order - b.group_order);
  const riskSignals = db.workflow_request_risk_signals
    .filter((item) => item.request_id === requestId)
    .slice()
    .sort((a, b) => a.signal_order - b.signal_order);
  const activities = db.activities
    .filter((item) => item.subject_id === requestId)
    .slice()
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const ownerRouting = ownerGroups.map((item) => item.owner_group).join(" + ");
  const riskSignalNames = riskSignals.map((item) => item.signal_name).join(", ");
  const supportCase = contract
    ? `Open ${contract.support_plan} support case for ${account?.tier || "account"} account`
    : "Open support case for split-shipment exception";
  const replacementPlan =
    "Partial fulfillment split, carrier delay monitored, inventory reserved, replacement shipment queued.";
  const baseDueAt = addHours(referenceTime, 4);

  upsertBy(db.workflow_state, (item) => item.request_id === requestId, {
    request_id: requestId,
    account_id: request.account_id,
    task_id: request.task_id,
    title: request.title,
    status: request.expected_outcome,
    next_step: request.next_step,
    owner_group_count: ownerGroups.length,
    owner_routing: ownerRouting,
    risk_signal_count: riskSignals.length,
    risk_signal_names: riskSignalNames,
    account_tier: account?.tier || null,
    support_plan: contract?.support_plan || null,
    support_case: supportCase,
    replacement_plan: replacementPlan,
    audit_timeline_count: activities.length,
    audit_timeline_last_at: activities.length ? activities[activities.length - 1].occurred_at : referenceTime,
    customer_message: request.customer_message,
    updated_at: referenceTime
  });

  ownerGroups.forEach((group) => {
    upsertBy(
      db.owner_tasks,
      (item) => item.request_id === requestId && item.owner_group === group.owner_group,
      {
        request_id: requestId,
        account_id: request.account_id,
        owner_group: group.owner_group,
        group_order: group.group_order,
        title: `${group.owner_group}: resolve split-shipment exception`,
        summary: `${group.owner_group} to reconcile partial fulfillment, carrier delay, inventory reservation, support case, and audit timeline.`,
        due_at: addHours(baseDueAt, group.group_order - 1),
        status: "open",
        created_at: referenceTime
      }
    );
  });

  upsertBy(db.customer_messages, (item) => item.request_id === requestId, {
    request_id: requestId,
    account_id: request.account_id,
    body: request.customer_message,
    customer_visible: true,
    channel: "portal",
    created_at: referenceTime
  });

  upsertBy(
    db.audit_events,
    (item) => item.request_id === requestId && item.event_type === "split_shipment_exception_activated",
    {
      request_id: requestId,
      account_id: request.account_id,
      event_type: "split_shipment_exception_activated",
      event: "split_shipment_exception_activated",
      detail: `Split-shipment exception opened for ${account?.name || request.title}; partial fulfillment, carrier delay, inventory reservation, ${account?.tier || "unknown"} tier, ${contract?.support_plan || "standard"} support, and ${activities.length} audit entries were reconciled; ${ownerRouting} own the response.`,
      customer_visible: true,
      occurred_at: referenceTime,
      owner_routing: ownerRouting,
      risk_signal_count: riskSignals.length,
      support_case: supportCase,
      replacement_plan: replacementPlan
    }
  );

  return buildPortalView(db);
}

function upsertBy(collection, predicate, document) {
  const index = collection.findIndex(predicate);
  if (index === -1) {
    collection.push(document);
    return;
  }

  collection[index] = document;
}

function addHours(isoTimestamp, hours) {
  return new Date(new Date(isoTimestamp).getTime() + hours * 60 * 60 * 1000).toISOString();
}
