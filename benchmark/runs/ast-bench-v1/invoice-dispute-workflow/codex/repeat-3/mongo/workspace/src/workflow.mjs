import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests?.[0];

  if (!request) {
    return buildPortalView(db);
  }

  const account = db.accounts?.find((item) => item._id === request.accountId);
  const activities = (db.activities || []).filter(
    (item) => item.accountId === request.accountId && item.subjectId === request._id
  );
  const ownerGroups = Array.isArray(request.ownerGroups) ? [...request.ownerGroups] : [];
  const riskSignals = Array.isArray(request.riskSignals)
    ? request.riskSignals.map((signal) => ({ ...signal }))
    : [];
  const status = request.expectedOutcome;
  const customerMessage = request.customerMessage || status;

  replaceDocuments(db.workflow_state, (item) => item.requestId === request._id, [
    {
      _id: request._id,
      requestId: request._id,
      accountId: request.accountId,
      taskId: request.taskId,
      title: request.title,
      status,
      ownerGroups,
      primaryOwnerGroup: ownerGroups[0] || null,
      nextStep: request.nextStep,
      riskSignals,
      evidenceBundle: buildEvidenceBundle(account, activities, ownerGroups, status, now),
      customerMessage,
      updatedAt: now
    }
  ]);

  replaceDocuments(
    db.owner_tasks,
    (item) => item.requestId === request._id,
    ownerGroups.map((ownerGroup, index) => ({
      _id: `${request._id}-owner-${slugify(ownerGroup)}`,
      requestId: request._id,
      accountId: request.accountId,
      ownerGroup,
      title: buildOwnerTaskTitle(ownerGroup, request.title),
      status: "open",
      dueAt: addHours(now, 4 + index),
      createdAt: now,
      priority: index === 0 ? "high" : "normal",
      taskType: index === 0 ? "approval" : "review"
    }))
  );

  replaceDocuments(db.customer_messages, (item) => item.requestId === request._id, [
    {
      _id: `${request._id}-customer-message`,
      requestId: request._id,
      accountId: request.accountId,
      channel: "customer-portal",
      customerVisible: true,
      status: "sent",
      body: customerMessage,
      createdAt: now
    }
  ]);

  replaceDocuments(db.audit_events, (item) => item.requestId === request._id, [
    {
      _id: `${request._id}-audit-event`,
      requestId: request._id,
      accountId: request.accountId,
      eventType: "workflow.state.published",
      customerVisible: true,
      status,
      summary: status,
      detail: `Invoice dispute workflow activated with ${activities.length} evidence records and ${ownerGroups.length} owner tasks.`,
      occurredAt: now,
      createdAt: now
    }
  ]);

  return buildPortalView(db);
}

function buildEvidenceBundle(account, activities, ownerGroups, status, now) {
  return {
    accountContract: account?.contract
      ? {
          contractId: account.contract.contractId,
          renewalDate: account.contract.renewalDate,
          arrCents: account.contract.arrCents,
          supportPlan: account.contract.supportPlan
        }
      : null,
    accountContext: account?.context
      ? {
          healthScore: account.context.healthScore,
          usageTrend: account.context.usageTrend,
          openCases: account.context.openCases,
          invoiceRisk: account.context.invoiceRisk,
          complianceFlags: [...(account.context.complianceFlags || [])]
        }
      : null,
    supportEvidence: activities.map((activity) => ({
      activityId: activity._id,
      summary: activity.summary,
      occurredAt: activity.occurredAt
    })),
    ownerApprovalsRequested: ownerGroups.map((ownerGroup) => ({
      ownerGroup,
      status: "open",
      requestedAt: now
    })),
    customerSafeStatus: status
  };
}

function buildOwnerTaskTitle(ownerGroup, requestTitle) {
  return `${ownerGroup} review for ${requestTitle}`;
}

function replaceDocuments(collection, predicate, nextDocs) {
  if (!Array.isArray(collection)) {
    return;
  }

  for (let index = collection.length - 1; index >= 0; index -= 1) {
    if (predicate(collection[index])) {
      collection.splice(index, 1);
    }
  }

  collection.push(...nextDocs);
}

function addHours(isoDate, hours) {
  return new Date(new Date(isoDate).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
