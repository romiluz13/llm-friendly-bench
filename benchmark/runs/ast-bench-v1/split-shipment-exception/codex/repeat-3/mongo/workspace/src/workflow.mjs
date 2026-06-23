import { buildPortalView } from "./portal-view.mjs";

const CUSTOMER_STATUS = "Split-shipment exception active with replacement plan, owners, customer message, and audit trail.";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId);
  const ownerGroups = [...request.ownerGroups];
  const riskSignals = request.riskSignals.map((signal) => ({ ...signal }));
  const activities = db.activities.filter((item) => item.subjectId === request._id);
  const auditTimeline = activities.map((activity) => ({
    activityId: activity._id,
    summary: activity.summary,
    occurredAt: activity.occurredAt
  }));
  const supportCase = {
    tier: account?.tier ?? null,
    supportPlan: account?.contract?.supportPlan ?? null,
    openCases: account?.context?.openCases ?? null
  };

  db.workflow_state.push({
    requestId: request._id,
    accountId: request.accountId,
    title: request.title,
    status: request.expectedOutcome || CUSTOMER_STATUS,
    nextStep: request.nextStep,
    ownerGroups,
    riskSignals,
    customerMessage: request.customerMessage,
    accountTier: account?.tier ?? null,
    supportCase,
    replacementPlan: {
      partialFulfillment: "Hold the original line and reserve replacement inventory.",
      carrierDelay: "Track the delayed carrier handoff against the audit timeline.",
      inventoryReservation: "Keep replacement units reserved for the enterprise account.",
      supportCase
    },
    auditTimeline,
    updatedAt: now
  });

  ownerGroups.forEach((ownerGroup, index) => {
    const detailsByOwner = {
      Operations: "Verify the partial fulfillment and reserve the replacement stock.",
      Support: "Coordinate the customer-safe update and support case follow-up.",
      Finance: "Confirm the account tier exposure and any billing risk.",
      Logistics: "Reconcile the carrier delay and replacement shipment routing."
    };

    db.owner_tasks.push({
      requestId: request._id,
      accountId: request.accountId,
      ownerGroup,
      title: `${ownerGroup} split-shipment action`,
      status: "open",
      dueAt: now,
      details: detailsByOwner[ownerGroup] || request.nextStep,
      sequence: index + 1
    });
  });

  db.customer_messages.push({
    requestId: request._id,
    accountId: request.accountId,
    body: request.customerMessage,
    status: "sent",
    customerVisible: true,
    createdAt: now
  });

  db.audit_events.push({
    requestId: request._id,
    accountId: request.accountId,
    type: "split-shipment-exception-activated",
    status: request.expectedOutcome || CUSTOMER_STATUS,
    summary: request.title,
    timeline: auditTimeline,
    owners: ownerGroups,
    riskSignals,
    customerVisible: true,
    createdAt: now
  });

  return buildPortalView(db);
}
