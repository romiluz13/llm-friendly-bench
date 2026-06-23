import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((row) => row.account_id === request.account_id);
  const contract = db.account_contracts.find((row) => row.account_id === request.account_id);

  const ownerGroups = db.workflow_request_owner_groups
    .filter((row) => row.request_id === request.request_id)
    .sort((a, b) => a.group_order - b.group_order);
  const riskSignals = db.workflow_request_risk_signals
    .filter((row) => row.request_id === request.request_id)
    .sort((a, b) => a.signal_order - b.signal_order);

  const recoveryOwner = ownerGroups[ownerGroups.length - 1]?.owner_group ?? null;

  db.workflow_state.push({
    request_id: request.request_id,
    account_id: request.account_id,
    title: request.title,
    status: request.expected_outcome,
    next_step: request.next_step,
    account_tier: account?.tier ?? null,
    support_plan: contract?.support_plan ?? null,
    arr_cents: contract?.arr_cents ?? null,
    risk_signal_count: riskSignals.length,
    recovery_owner: recoveryOwner,
    opened_at: now
  });

  ownerGroups.forEach((group, index) => {
    const dueAt = new Date(now);
    dueAt.setUTCHours(dueAt.getUTCHours() + (index + 1) * 4);

    db.owner_tasks.push({
      request_id: request.request_id,
      owner_group: group.owner_group,
      title: `${group.owner_group} to drive recovery of ${request.title}`,
      due_at: dueAt.toISOString(),
      status: "open",
      created_at: now
    });
  });

  db.customer_messages.push({
    request_id: request.request_id,
    body: request.customer_message,
    audience: "customer",
    sent_at: now
  });

  db.audit_events.push({
    request_id: request.request_id,
    event: "at_risk_escalation_opened",
    summary: request.expected_outcome,
    owner_routing: ownerGroups.map((group) => group.owner_group).join(" + "),
    risk_signals: riskSignals.map((signal) => signal.signal_name).join(", "),
    customer_visible: true,
    recorded_at: now
  });

  return buildPortalView(db);
}
