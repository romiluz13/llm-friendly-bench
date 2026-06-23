import { buildPortalView } from "./portal-view.mjs";

const ESCALATION_STATUS =
  "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

const OWNER_TASK_HORIZON_HOURS = {
  "Customer Success": 4,
  Support: 8,
  Finance: 24,
  "Executive Sponsor": 12,
  Legal: 24
};

const DEFAULT_TASK_HORIZON_HOURS = 24;

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId) ?? null;
  const activities = db.activities.filter((item) => item.subjectId === request._id);
  const at = now ?? request.generatedAt ?? new Date().toISOString();
  const riskSignals = request.riskSignals.map((signal) => ({
    name: signal.name,
    detail: signal.detail
  }));
  const auditTimeline = activities.map((item) => ({
    activityId: item._id,
    summary: item.summary,
    occurredAt: item.occurredAt
  }));

  const workflowState = {
    _id: `state-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    taskId: request.taskId,
    title: request.title,
    status: ESCALATION_STATUS,
    nextStep: request.nextStep,
    recoveryOwner: "Executive Sponsor",
    routing: {
      customerSuccess: "Customer Success",
      legal: "Legal",
      finance: "Finance",
      support: "Support",
      executiveRecoveryOwner: "Executive Sponsor"
    },
    ownerGroups: [...request.ownerGroups],
    riskSignals,
    context: {
      account: account
        ? {
            accountId: account._id,
            name: account.name,
            tier: account.tier,
            region: account.region
          }
        : null,
      contract: account ? { ...account.contract } : null,
      support: account
        ? {
            supportPlan: account.contract?.supportPlan ?? null,
            openCases: account.context?.openCases ?? null,
            contacts: account.contacts.map((contact) => ({
              contactId: contact.contactId,
              role: contact.role,
              email: contact.email
            }))
          }
        : null,
      invoice: account
        ? {
            risk: account.context?.invoiceRisk ?? null,
            exposureCents: account.contract?.arrCents ?? null
          }
        : null,
      usage: account
        ? {
            healthScore: account.context?.healthScore ?? null,
            usageTrend: account.context?.usageTrend ?? null
          }
        : null,
      shipment: {
        status: "delayed",
        priority: "high-value",
        orderType: "strategic account rescue"
      },
      regulatory: account
        ? {
            complianceFlags: [...(account.context?.complianceFlags ?? [])]
          }
        : null,
      audit: {
        customerVisible: true,
        activityIds: auditTimeline.map((item) => item.activityId),
        timeline: auditTimeline
      }
    },
    auditTimeline,
    openedAt: at,
    updatedAt: at
  };

  const ownerTasks = request.ownerGroups.map((ownerGroup, index) => ({
    _id: `task-${request._id}-${index + 1}`,
    requestId: request._id,
    accountId: request.accountId,
    ownerGroup,
    title: `${ownerGroup} recovery action for ${request.title}`,
    status: "open",
    dueAt: addHours(at, OWNER_TASK_HORIZON_HOURS[ownerGroup] ?? DEFAULT_TASK_HORIZON_HOURS),
    createdAt: at
  }));

  const customerMessage = {
    _id: `message-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    channel: "portal",
    visibility: "customer",
    audience: "customer",
    customerSafe: true,
    body:
      request.customerMessage ||
      `${request.title} is being handled by ${request.ownerGroups.join(", ")}.`,
    createdAt: at
  };

  const auditEvent = {
    _id: `audit-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    type: "escalation.activated",
    actor: "workflow-engine",
    summary: ESCALATION_STATUS,
    ownerGroups: [...request.ownerGroups],
    riskSignals: riskSignals.map((signal) => signal.name),
    timelineActivityIds: auditTimeline.map((item) => item.activityId),
    customerVisible: true,
    occurredAt: at
  };

  replaceByRequestId(db, "workflow_state", request._id, [workflowState]);
  replaceByRequestId(db, "owner_tasks", request._id, ownerTasks);
  replaceByRequestId(db, "customer_messages", request._id, [customerMessage]);
  replaceByRequestId(db, "audit_events", request._id, [auditEvent]);

  return buildPortalView(db);
}

function replaceByRequestId(db, collectionName, requestId, records) {
  const existing = db[collectionName] ?? [];
  db[collectionName] = existing.filter((item) => item.requestId !== requestId).concat(records);
}

function addHours(iso, hours) {
  const date = new Date(iso);
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString();
}
