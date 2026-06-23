import { buildPortalView } from "./portal-view.mjs";

const CUSTOMER_FACING_STATUS =
  "Invoice dispute active with finance owner, evidence bundle, and customer-safe status.";

const TASK_HOURS_BY_OWNER = {
  Finance: 4,
  "Customer Success": 8,
  Legal: 24,
  Operations: 12
};

function addHours(isoNow, hours) {
  return new Date(new Date(isoNow).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function buildEvidenceBundle(account, activities) {
  const contract = account?.contract ?? {};
  const context = account?.context ?? {};
  return {
    contract: {
      contractId: contract.contractId,
      renewalDate: contract.renewalDate,
      arrCents: contract.arrCents,
      supportPlan: contract.supportPlan
    },
    invoiceRisk: context.invoiceRisk,
    openCases: context.openCases,
    complianceFlags: context.complianceFlags ?? [],
    activityTrail: activities.map((item) => ({
      activityId: item._id,
      summary: item.summary,
      occurredAt: item.occurredAt
    }))
  };
}

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId);
  const activities = db.activities.filter(
    (item) => item.accountId === request.accountId && item.subjectId === request._id
  );

  db.workflow_state.push({
    requestId: request._id,
    status: CUSTOMER_FACING_STATUS,
    title: request.title,
    nextStep: request.nextStep,
    riskSignals: request.riskSignals,
    ownerGroups: request.ownerGroups,
    evidenceBundle: buildEvidenceBundle(account, activities),
    updatedAt: now
  });

  for (const ownerGroup of request.ownerGroups) {
    db.owner_tasks.push({
      requestId: request._id,
      ownerGroup,
      title: `${ownerGroup} review for ${request.title}`,
      dueAt: addHours(now, TASK_HOURS_BY_OWNER[ownerGroup] ?? 24),
      status: "open"
    });
  }

  db.customer_messages.push({
    requestId: request._id,
    body: request.customerMessage,
    sentAt: now
  });

  db.audit_events.push({
    requestId: request._id,
    action: "invoice-dispute-workflow.activated",
    actor: "workflow-engine",
    customerVisible: true,
    at: now
  });

  return buildPortalView(db);
}
