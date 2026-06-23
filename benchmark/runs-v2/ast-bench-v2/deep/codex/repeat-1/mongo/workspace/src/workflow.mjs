import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts?.find((item) => item._id === request.accountId) ?? db.accounts?.[0] ?? null;
  const ownerGroups = [...(request.ownerGroups ?? [])];
  const recoveryOwner = ownerGroups[ownerGroups.length - 1] ?? "Executive Sponsor";
  const at = now ?? db.benchmark_fixture?.generatedAt ?? new Date().toISOString();
  const activities = (db.activities ?? [])
    .filter((item) => item.subjectId === request._id)
    .sort((left, right) => new Date(left.occurredAt) - new Date(right.occurredAt));
  const riskSignals = (request.riskSignals ?? []).map((signal) => ({
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
    summary: "At-risk escalation active with executive recovery owner routing and customer-visible audit history.",
    actor: "workflow-engine",
    ownerGroups: [...ownerGroups],
    riskSignals: riskSignals.map((signal) => signal.name),
    occurredAt: at,
    customerVisible: true,
    sequence: activityTimeline.length + 1
  };
  const auditTimeline = [...activityTimeline, customerVisibleTimelineEntry];
  const workflowState = {
    _id: `state-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    taskId: request.taskId,
    title: request.title,
    status: "At-risk escalation active with executive recovery owner routing and customer-visible audit history.",
    nextStep: "Customer Success, Legal, Finance, and Support to confirm the recovery plan by 16:00 UTC.",
    recoveryOwner,
    ownerGroups: [...ownerGroups],
    riskSignals,
    accountTier: account?.tier ?? null,
    healthScore: account?.context?.healthScore ?? null,
    routing: {
      ownerGroups: [...ownerGroups],
      coordinationGroups: ["Customer Success", "Legal", "Finance", "Support"],
      executiveRecoveryOwner: recoveryOwner
    },
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
  const ownerTasks = ownerGroups.map((ownerGroup, index) => ({
    _id: `task-${request._id}-${index + 1}`,
    requestId: request._id,
    accountId: request.accountId,
    ownerGroup,
    title: `${ownerGroup} recovery action for ${request.title}`,
    dueAt: addHours(at, OWNER_TASK_HORIZON_HOURS[ownerGroup] ?? DEFAULT_TASK_HORIZON_HOURS),
    status: "open",
    createdAt: at
  }));
  const customerMessage = {
    _id: `msg-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    channel: "portal",
    visibility: "customer",
    audience: "customer",
    customerSafe: true,
    body: "We have activated the recovery plan for your delayed order and are coordinating updates through the portal.",
    createdAt: at
  };
  const auditEvents = [
    ...activityTimeline.map((activity, index) => ({
      _id: `audit-${activity.activityId}`,
      requestId: request._id,
      accountId: request.accountId,
      subjectId: request._id,
      type: "account.activity.logged",
      summary: activity.summary,
      occurredAt: activity.occurredAt,
      customerVisible: false,
      sequence: index + 1
    })),
    {
      _id: `audit-${request._id}-customer-visible`,
      requestId: request._id,
      accountId: request.accountId,
      subjectId: request._id,
      type: "customer-visible-status",
      summary: "At-risk escalation active with executive recovery owner routing and customer-visible audit history.",
      actor: "workflow-engine",
      ownerGroups: [...ownerGroups],
      coordinationGroups: ["Customer Success", "Legal", "Finance", "Support"],
      riskSignals: riskSignals.map((signal) => signal.name),
      customerVisible: true,
      occurredAt: at,
      sequence: auditTimeline.length
    }
  ];

  db.workflow_state = replaceByRequestId(db.workflow_state, request._id, [workflowState]);
  db.owner_tasks = replaceByRequestId(db.owner_tasks, request._id, ownerTasks);
  db.customer_messages = replaceByRequestId(db.customer_messages, request._id, [customerMessage]);
  db.audit_events = replaceByRequestId(db.audit_events, request._id, auditEvents);
  return buildPortalView(db);
}

const OWNER_TASK_HORIZON_HOURS = {
  "Customer Success": 4,
  Support: 8,
  Finance: 24,
  "Executive Sponsor": 12,
  Legal: 24
};

const DEFAULT_TASK_HORIZON_HOURS = 24;

function replaceByRequestId(collection, requestId, records) {
  const existing = collection ?? [];
  return existing.filter((item) => item.requestId !== requestId).concat(records);
}

function addHours(iso, hours) {
  const base = new Date(iso);
  base.setUTCHours(base.getUTCHours() + hours);
  return base.toISOString();
}
