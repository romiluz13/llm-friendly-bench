import { createHash } from "node:crypto";
import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const requestId = request.request_id;
  const readyStatus = request.expected_outcome || "Audit export ready with scoped records, approvers, customer-safe summary, and hashable audit trail.";
  const account = db.accounts.find((item) => item.account_id === request.account_id) || null;
  const contract = db.account_contracts.find((item) => item.account_id === request.account_id) || null;
  const contacts = db.contacts
    .filter((item) => item.account_id === request.account_id)
    .slice()
    .sort((a, b) => a.role.localeCompare(b.role) || a.contact_id.localeCompare(b.contact_id));
  const ownerGroups = db.workflow_request_owner_groups
    .filter((item) => item.request_id === requestId)
    .slice()
    .sort((a, b) => a.group_order - b.group_order);
  const riskSignals = db.workflow_request_risk_signals
    .filter((item) => item.request_id === requestId)
    .slice()
    .sort((a, b) => a.signal_order - b.signal_order);
  const activities = db.activities
    .filter((item) => item.account_id === request.account_id && item.subject_id === requestId)
    .slice()
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
  const ownerGroupSummary = ownerGroups.map((item) => item.owner_group).join(", ");
  const approvalHistorySummary = `${ownerGroups.length} approvals requested: ${ownerGroupSummary}`;
  const scopedRecordCount = [account, contract].filter(Boolean).length + contacts.length + activities.length;
  const auditTrailHash = createHash("sha256").update(JSON.stringify({
    request_id: requestId,
    account_id: request.account_id,
    account_name: account?.name ?? null,
    account_tier: account?.tier ?? null,
    region: account?.region ?? null,
    contract_id: contract?.contract_id ?? null,
    support_plan: contract?.support_plan ?? null,
    renewal_date: contract?.renewal_date ?? null,
    arr_cents: contract?.arr_cents ?? null,
    contact_ids: contacts.map((item) => item.contact_id),
    contact_roles: contacts.map((item) => item.role),
    activity_ids: activities.map((item) => item.activity_id),
    activity_summaries: activities.map((item) => item.summary),
    owner_groups: ownerGroups.map((item) => item.owner_group),
    risk_signals: riskSignals.map((item) => ({ name: item.signal_name, detail: item.detail })),
    status: readyStatus,
    export_status: "ready",
    now
  })).digest("hex");
  const customerSafeSummary = buildCustomerSafeSummary({
    accountName: account?.name ?? request.title,
    scopedRecordCount,
    approverCount: ownerGroups.length,
    auditTrailHash
  });

  replaceRequestRows(db.workflow_state, requestId, [{
    request_id: requestId,
    task_id: request.task_id,
    account_id: request.account_id,
    title: request.title,
    status: readyStatus,
    export_status: "ready",
    next_step: request.next_step,
    customer_safe_summary: customerSafeSummary,
    customer_message: customerSafeSummary,
    account_name: account?.name ?? null,
    account_tier: account?.tier ?? null,
    region: account?.region ?? null,
    contract_id: contract?.contract_id ?? null,
    support_plan: contract?.support_plan ?? null,
    renewal_date: contract?.renewal_date ?? null,
    arr_cents: contract?.arr_cents ?? null,
    contact_count: contacts.length,
    contact_roles_summary: contacts.map((item) => item.role).join(", "),
    activity_count: activities.length,
    activity_summary: activities.map((item) => item.summary).join(" | "),
    owner_group_count: ownerGroups.length,
    owner_group_summary: ownerGroupSummary,
    approver_count: ownerGroups.length,
    approval_history_summary: approvalHistorySummary,
    risk_signal_count: riskSignals.length,
    risk_signal_summary: riskSignals.map((item) => item.signal_name).join(", "),
    scoped_record_count: scopedRecordCount,
    audit_trail_hash: auditTrailHash,
    updated_at: now
  }]);

  const dueAt = new Date(new Date(now).getTime() + 24 * 60 * 60 * 1000).toISOString();
  replaceRequestRows(db.owner_tasks, requestId, ownerGroups.map((item, index) => ({
    request_id: requestId,
    owner_group: item.owner_group,
    title: `${item.owner_group} review for ${request.title}`,
    status: "open",
    task_order: item.group_order,
    due_at: dueAt,
    created_at: now,
    priority: index === 0 ? "high" : "normal"
  })));

  replaceRequestRows(db.customer_messages, requestId, [{
    request_id: requestId,
    body: customerSafeSummary,
    channel: "portal",
    customer_visible: true,
    status: "sent",
    created_at: now
  }]);

  replaceRequestRows(db.audit_events, requestId, [{
    request_id: requestId,
    event_type: "audit_export_ready",
    summary: readyStatus,
    customer_visible: true,
    export_status: "ready",
    customer_safe_summary: customerSafeSummary,
    approval_history_summary: approvalHistorySummary,
    scoped_record_count: scopedRecordCount,
    owner_group_count: ownerGroups.length,
    risk_signal_count: riskSignals.length,
    audit_trail_hash: auditTrailHash,
    hash: auditTrailHash,
    occurred_at: now
  }]);

  return buildPortalView(db);
}

function buildCustomerSafeSummary({ accountName, scopedRecordCount, approverCount, auditTrailHash }) {
  return `${accountName} audit export is ready with ${scopedRecordCount} scoped records, ${approverCount} approvers, and verification hash ${auditTrailHash.slice(0, 12)}...`;
}

function replaceRequestRows(rows, requestId, nextRows) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].request_id === requestId) {
      rows.splice(index, 1);
    }
  }

  rows.push(...nextRows);
}
