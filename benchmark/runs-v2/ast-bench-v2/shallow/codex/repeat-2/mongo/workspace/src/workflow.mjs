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

const CUSTOMER_SAFE_MESSAGE =
  "We have activated the recovery plan for your delayed order and are coordinating updates through the portal.";

const COORDINATION_GROUPS = ["Customer Success", "Legal", "Finance", "Support"];

const DEFAULT_TASK_HORIZON_HOURS = 24;

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts?.find((item) => item._id === request.accountId) ?? db.accounts?.[0] ?? null;
  const at = now ?? request.generatedAt ?? new Date().toISOString();
  const activities = (db.activities ?? [])
    .filter((item) => item.subjectId === request._id)
    .sort((left, right) => new Date(left.occurredAt) - new Date(right.occurredAt));
  const riskSignals = request.riskSignals.map((signal) => ({
    name: signal.name,
    detail: signal.detail,
    raisedAt: at
  }));
  const activityTimeline = activities.map((activity, index) => ({
    activityId: activity._id,
    summary: activity.summary,
    occurredAt: activity.occurredAt,
    sequence: index + 1,
    customerVisible: false
  }));
  const customerVisibleTimelineEntry = {
    _id: `audit-${request._id}-customer-visible`,
    eventType: "customer-visible-status",
    summary: ESCALATION_STATUS,
    actor: "workflow-engine",
    ownerGroups: [...request.ownerGroups],
    riskSignals: riskSignals.map((signal) => signal.name),
    occurredAt: at,
    customerVisible: true
  };
  const auditTimeline = [...activityTimeline, customerVisibleTimelineEntry];
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
      executiveRecoveryOwner: "Executive Sponsor",
      coordinationGroups: [...COORDINATION_GROUPS]
    },
    ownerGroups: [...request.ownerGroups],
    riskSignals,
    context: account
      ? {
          account: {
            accountId: account._id,
            name: account.name,
            tier: account.tier,
            region: account.region
          },
          contract: { ...account.contract },
          support: {
            supportPlan: account.contract?.supportPlan ?? null,
            openCases: account.context?.openCases ?? null,
            contacts: account.contacts.map((contact) => ({
              contactId: contact.contactId,
              role: contact.role,
              email: contact.email
            }))
          },
          invoice: {
            risk: account.context?.invoiceRisk ?? null,
            exposureCents: account.contract?.arrCents ?? null
          },
          usage: {
            healthScore: account.context?.healthScore ?? null,
            usageTrend: account.context?.usageTrend ?? null
          },
          shipment: {
            status: "delayed",
            priority: "high-value",
            orderType: "high-value order"
          },
          regulatory: {
            complianceFlags: [...(account.context?.complianceFlags ?? [])],
            legalReview: true
          },
          audit: {
            customerVisible: true,
            activityIds: activityTimeline.map((item) => item.activityId),
            timeline: auditTimeline
          }
        }
      : null,
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
    body: request.customerMessage || CUSTOMER_SAFE_MESSAGE,
    createdAt: at
  };
  const auditEvents = [
    ...activityTimeline.map((item) => ({
      _id: `audit-${item.activityId}`,
      requestId: request._id,
      accountId: request.accountId,
      subjectId: request._id,
      type: "account.activity.logged",
      summary: item.summary,
      occurredAt: item.occurredAt,
      customerVisible: false,
      sequence: item.sequence
    })),
    {
      _id: `audit-${request._id}-customer-visible`,
      requestId: request._id,
      accountId: request.accountId,
      subjectId: request._id,
      type: "escalation.activated",
      summary: ESCALATION_STATUS,
      actor: "workflow-engine",
      ownerGroups: [...request.ownerGroups],
      riskSignals: riskSignals.map((signal) => signal.name),
      customerVisible: true,
      occurredAt: at
    }
  ];

  db.workflow_state = replaceByRequestId(db.workflow_state, request._id, [workflowState]);
  db.owner_tasks = replaceByRequestId(db.owner_tasks, request._id, ownerTasks);
  db.customer_messages = replaceByRequestId(db.customer_messages, request._id, [customerMessage]);
  db.audit_events = replaceByRequestId(db.audit_events, request._id, auditEvents);

  return buildPortalView(db);
}

function replaceByRequestId(collection, requestId, records) {
  const existing = collection ?? [];
  return existing.filter((item) => item.requestId !== requestId).concat(records);
}

function addHours(iso, hours) {
  const date = new Date(iso);
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString();
}
