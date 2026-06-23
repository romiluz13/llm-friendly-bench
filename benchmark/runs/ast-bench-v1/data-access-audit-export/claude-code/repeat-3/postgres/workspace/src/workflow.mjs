import { createHash } from "node:crypto";
import { buildPortalView } from "./portal-view.mjs";

const REVIEW_WINDOW_HOURS = 4;

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const requestId = request.request_id;

  const approvers = db.workflow_request_owner_groups
    .filter((row) => row.request_id === requestId)
    .sort((a, b) => a.group_order - b.group_order);

  const riskSignals = db.workflow_request_risk_signals
    .filter((row) => row.request_id === requestId)
    .sort((a, b) => a.signal_order - b.signal_order)
    .map((row) => ({ name: row.signal_name, detail: row.detail }));

  const scopedRecords = scopeRecords(db, request);
  const status = request.expected_outcome;
  const dueAt = new Date(new Date(now).getTime() + REVIEW_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  replaceForRequest(db.workflow_state, requestId);
  db.workflow_state.push({
    request_id: requestId,
    account_id: request.account_id,
    title: request.title,
    status,
    next_step: request.next_step,
    risk_signals: riskSignals,
    scoped_records: scopedRecords,
    updated_at: now
  });

  replaceForRequest(db.owner_tasks, requestId);
  for (const approver of approvers) {
    db.owner_tasks.push({
      request_id: requestId,
      owner_group: approver.owner_group,
      title: `${approver.owner_group} sign-off for ${request.title}`,
      due_at: dueAt,
      status: "open"
    });
  }

  replaceForRequest(db.customer_messages, requestId);
  db.customer_messages.push({
    request_id: requestId,
    body: request.customer_message,
    sent_at: now
  });

  const auditPayload = {
    request_id: requestId,
    account_id: request.account_id,
    status,
    approvers: approvers.map((approver) => approver.owner_group),
    risk_signals: riskSignals,
    scoped_records: scopedRecords,
    occurred_at: now
  };
  replaceForRequest(db.audit_events, requestId);
  db.audit_events.push({
    request_id: requestId,
    action: "data-access-audit-export",
    payload: auditPayload,
    hash: createHash("sha256").update(JSON.stringify(auditPayload)).digest("hex"),
    customer_visible: true,
    occurred_at: now
  });

  return buildPortalView(db);
}

function scopeRecords(db, request) {
  const accountId = request.account_id;
  const forAccount = (rows) => rows.filter((row) => row.account_id === accountId);
  return {
    account: db.accounts.find((row) => row.account_id === accountId) || null,
    contracts: forAccount(db.account_contracts),
    contacts: forAccount(db.contacts),
    activities: db.activities.filter((row) => row.subject_id === request.request_id)
  };
}

function replaceForRequest(rows, requestId) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].request_id === requestId) {
      rows.splice(index, 1);
    }
  }
}
