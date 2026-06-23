import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item.account_id === request.account_id);
  const contacts = db.contacts.filter((item) => item.account_id === request.account_id);
  const ownerGroups = splitDelimited(request.owner_groups);
  const riskSignals = splitRiskSignals(request.risk_signals);
  const riskSummary = `${riskSignals.length} signals: ${riskSignals.map((item) => item.signal_name).join(", ")}`;
  const auditTimeline = [
    `Escalation opened for ${account?.name ?? request.account_id} on ${request.title}`,
    `Account tier ${account?.tier ?? "unknown"} with ${account?.support_plan ?? "unknown"} support and contract ${account?.contract_id ?? "unknown"} reviewed`,
    `Contacts on file: ${contacts.map((item) => item.role).join(", ") || "none"}`,
    "Invoice, usage, shipment, regulatory, and audit context combined for escalation routing.",
    `Risk signals captured: ${riskSignals.map((item) => item.signal_name).join(", ")}`,
    `Owner routing assigned to ${ownerGroups.join(", ")}`,
    "Customer-visible audit history published"
  ].join(" | ");

  upsertRows(db.workflow_state, request.request_id, {
    request_id: request.request_id,
    task_id: request.task_id,
    account_id: request.account_id,
    title: request.title,
    primary_entity: request.primary_entity,
    status: request.expected_outcome,
    expected_outcome: request.expected_outcome,
    next_step: request.next_step,
    owner_groups: request.owner_groups,
    risk_signals: request.risk_signals,
    risk_signal_count: riskSignals.length,
    risk_summary: riskSummary,
    customer_message: request.customer_message,
    account_tier: account?.tier ?? "",
    contract_id: account?.contract_id ?? "",
    renewal_date: account?.renewal_date ?? "",
    arr_cents: account?.arr_cents ?? 0,
    support_plan: account?.support_plan ?? "",
    contact_roles: contacts.map((item) => item.role).join("|"),
    audit_timeline: auditTimeline,
    updated_at: now
  });

  upsertRows(
    db.owner_tasks,
    request.request_id,
    ...ownerGroups.map((ownerGroup, index) => ({
      request_id: request.request_id,
      task_id: `${request.task_id}-${index + 1}`,
      account_id: request.account_id,
      owner_group: ownerGroup,
      title: buildTaskTitle(ownerGroup),
      due_at: addHours(now, index + 1),
      status: "open"
    }))
  );

  upsertRows(db.customer_messages, request.request_id, {
    request_id: request.request_id,
    body: request.customer_message,
    customer_visible: true,
    created_at: now
  });

  upsertRows(db.audit_events, request.request_id, {
    request_id: request.request_id,
    event_id: `${request.request_id}-audit-1`,
    event_type: "customer_visible_audit",
    customer_visible: true,
    occurred_at: now,
    detail: auditTimeline,
    timeline: auditTimeline
  });

  return buildPortalView(db);
}

function splitDelimited(value) {
  return (value ? String(value).split("|") : []).map((item) => item.trim()).filter(Boolean);
}

function splitRiskSignals(value) {
  return splitDelimited(value).map((entry) => {
    const separator = entry.indexOf(":");
    return {
      signal_name: separator >= 0 ? entry.slice(0, separator) : entry,
      detail: separator >= 0 ? entry.slice(separator + 1) : ""
    };
  });
}

function buildTaskTitle(ownerGroup) {
  switch (ownerGroup) {
    case "Customer Success":
      return "Coordinate recovery plan and customer communication";
    case "Support":
      return "Validate delay impact and shipment recovery";
    case "Finance":
      return "Review invoice exposure and account terms";
    case "Legal":
      return "Review regulatory and contract exposure";
    case "Executive Sponsor":
      return "Provide executive recovery oversight";
    default:
      return `${ownerGroup} recovery action`;
  }
}

function addHours(isoTimestamp, hours) {
  return new Date(new Date(isoTimestamp).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function upsertRows(table, requestId, ...rows) {
  const remaining = table.filter((item) => item.request_id !== requestId);
  table.splice(0, table.length, ...remaining, ...rows);
}
