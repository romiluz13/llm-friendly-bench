import { createHash } from "node:crypto";
import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const requestId = request._id;

  // Scope the audit export to the requesting account and its activity trail.
  const account = db.accounts.find((item) => item._id === request.accountId);
  const scopedActivities = db.activities.filter(
    (item) => item.accountId === request.accountId && item.subjectId === requestId
  );

  // Owners and risk signals are resolved straight from the request contract.
  const ownerGroups = request.ownerGroups;
  const riskSignals = request.riskSignals;

  // Owner tasks fall due one business day out from the run timestamp.
  const dueAt = new Date(new Date(now).getTime() + 24 * 60 * 60 * 1000).toISOString();

  // Persist the workflow state. The customer-facing status is the request's expected outcome.
  db.workflow_state.push({
    requestId,
    accountId: request.accountId,
    title: request.title,
    status: request.expectedOutcome,
    nextStep: request.nextStep,
    riskSignals,
    approvers: ownerGroups,
    scopedRecordCount: scopedActivities.length,
    accountTier: account?.tier ?? null,
    updatedAt: now
  });

  // Persist one owner task per owner group, preserving routing order.
  for (const ownerGroup of ownerGroups) {
    db.owner_tasks.push({
      requestId,
      ownerGroup,
      title: `${ownerGroup}: ${request.title}`,
      dueAt,
      status: "open",
      createdAt: now
    });
  }

  // Persist the customer-safe message.
  db.customer_messages.push({
    requestId,
    body: request.customerMessage,
    createdAt: now
  });

  // Persist a customer-visible, hashable audit event closing the trail.
  const auditPayload = {
    requestId,
    status: request.expectedOutcome,
    owners: ownerGroups,
    signals: riskSignals.map((item) => item.name),
    scopedRecordCount: scopedActivities.length,
    at: now
  };
  db.audit_events.push({
    requestId,
    type: "audit-export-ready",
    customerVisible: true,
    payload: auditPayload,
    hash: createHash("sha256").update(JSON.stringify(auditPayload)).digest("hex"),
    createdAt: now
  });

  return buildPortalView(db);
}
