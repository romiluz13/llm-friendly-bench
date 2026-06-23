import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];

  const ownerGroups = db.workflow_request_owner_groups
    .filter((group) => group.request_id === request.request_id)
    .slice()
    .sort((a, b) => a.group_order - b.group_order);

  const signals = db.workflow_request_risk_signals
    .filter((signal) => signal.request_id === request.request_id)
    .slice()
    .sort((a, b) => a.signal_order - b.signal_order);

  const account = db.accounts.find((item) => item.account_id === request.account_id);
  const contract = db.account_contracts.find((item) => item.account_id === request.account_id);
  const ownerRouting = ownerGroups.map((group) => group.owner_group).join(" + ");
  const signalNames = signals.map((signal) => signal.signal_name).join(", ");

  db.workflow_state.push({
    request_id: request.request_id,
    title: request.title,
    status: request.expected_outcome,
    next_step: request.next_step,
    risk_signal_count: signals.length,
    owner_routing: ownerRouting,
    account_tier: account?.tier,
    support_plan: contract?.support_plan,
    updated_at: now
  });

  ownerGroups.forEach((group) => {
    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group: group.owner_group,
      title: `${group.owner_group}: resolve split-shipment exception`,
      due_at: now,
      status: "open",
      task_order: group.group_order
    });
  });

  db.customer_messages.push({
    request_id: request.request_id,
    body: request.customer_message,
    customer_visible: true,
    created_at: now
  });

  db.audit_events.push({
    request_id: request.request_id,
    event_type: "split_shipment_exception_activated",
    event: "split_shipment_exception_activated",
    detail: `Split-shipment exception opened for ${account?.name || request.account_id} (${account?.tier || "unknown"} tier, ${contract?.support_plan || "standard"} support); signals reconciled: ${signalNames || "none"}; routed to ${ownerRouting}.`,
    customer_visible: true,
    occurred_at: now
  });

  return buildPortalView(db);
}
