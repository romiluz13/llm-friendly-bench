import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item.account_id === request.account_id);
  const contacts = db.contacts.filter((item) => item.account_id === request.account_id);
  const ownerGroups = request.owner_groups.split("|");
  const riskSignals = request.risk_signals.split("|").map((entry) => {
    const separator = entry.indexOf(":");
    return {
      signal_name: separator >= 0 ? entry.slice(0, separator) : entry,
      detail: separator >= 0 ? entry.slice(separator + 1) : ""
    };
  });
  const status = "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";
  const riskSummary = `${riskSignals.length} signals: ${riskSignals.map((item) => item.signal_name).join(", ")}`;
  const dueAt = new Date(new Date(now).getTime() + 4 * 60 * 60 * 1000).toISOString();
  const auditTimeline = [
    `${now} request opened for delayed high-value order at strategic account ${account?.name || request.account_id}.`,
    `Account tier ${account?.tier || "unknown"} with contract ${account?.contract_id || "unknown"} and support plan ${account?.support_plan || "unknown"} reviewed.`,
    "Invoice, usage, shipment, regulatory, and audit context combined for escalation routing.",
    `Customer Success, Support, Finance, and Executive Sponsor tasks created for recovery.`,
    "Customer-safe portal state published with customer-visible audit history."
  ].join(" ");

  replaceRequestRows(db.workflow_state, request.request_id, [{
    request_id: request.request_id,
    task_id: request.task_id,
    account_id: request.account_id,
    title: request.title,
    primary_entity: request.primary_entity,
    status,
    next_step: request.next_step,
    owner_groups: request.owner_groups,
    risk_signals: request.risk_signals,
    risk_signal_count: String(riskSignals.length),
    risk_summary: riskSummary,
    customer_message: request.customer_message,
    account_tier: account?.tier || "",
    contract_id: account?.contract_id || "",
    support_plan: account?.support_plan || "",
    renewal_date: account?.renewal_date || "",
    region: account?.region || "",
    arr_cents: String(account?.arr_cents ?? ""),
    contact_roles: contacts.map((item) => item.role).join("|"),
    audit_timeline: auditTimeline,
    updated_at: now
  }]);

  replaceRequestRows(db.owner_tasks, request.request_id, ownerGroups.map((ownerGroup, index) => ({
    request_id: request.request_id,
    task_id: `${request.task_id}-${index + 1}`,
    account_id: request.account_id,
    owner_group: ownerGroup,
    title: `${ownerGroup} recovery task`,
    due_at: dueAt,
    status: "open",
    priority: "high",
    context: riskSummary
  })));

  replaceRequestRows(db.customer_messages, request.request_id, [{
    request_id: request.request_id,
    body: request.customer_message,
    audience: "customer",
    channel: "portal",
    status: "published",
    updated_at: now
  }]);

  replaceRequestRows(db.audit_events, request.request_id, [{
    request_id: request.request_id,
    event_type: "customer_visible_escalation_opened",
    customer_visible: true,
    body: `${status} ${request.customer_message}`,
    timeline: auditTimeline,
    occurred_at: now,
    actor: "system"
  }]);

  return buildPortalView(db);
}

function replaceRequestRows(table, requestId, rows) {
  for (let index = table.length - 1; index >= 0; index -= 1) {
    if (table[index].request_id === requestId) {
      table.splice(index, 1);
    }
  }

  table.push(...rows);
}
