import { buildPortalView } from "./portal-view.mjs";

const CUSTOMER_STATUS = "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId);
  const ownerGroups = [...request.ownerGroups];
  const timelineEvents = db.activities
    .filter((item) => item.accountId === account._id && item.subjectId === request._id)
    .sort((left, right) => new Date(left.occurredAt) - new Date(right.occurredAt));

  const auditEvents = [
    ...timelineEvents.map((activity, index) => ({
      _id: `audit-${activity._id}`,
      requestId: request._id,
      accountId: account._id,
      subjectId: request._id,
      eventType: "account-activity",
      summary: activity.summary,
      occurredAt: activity.occurredAt,
      customerVisible: false,
      sequence: index + 1
    })),
    {
      _id: `audit-${request._id}-customer-visible`,
      requestId: request._id,
      accountId: account._id,
      subjectId: request._id,
      eventType: "customer-visible-status",
      summary: "Customer-visible recovery history published in the portal.",
      occurredAt: now,
      customerVisible: true,
      sequence: timelineEvents.length + 1
    }
  ];

  db.workflow_state = [
    {
      _id: `workflow-state-${request._id}`,
      requestId: request._id,
      accountId: account._id,
      taskId: request.taskId,
      title: request.title,
      status: CUSTOMER_STATUS,
      nextStep: "Customer Success, Legal, Finance, and Support to confirm the recovery plan by 16:00 UTC.",
      riskSignals: structuredClone(request.riskSignals),
      context: {
        accountTier: account.tier,
        contract: structuredClone(account.contract),
        support: {
          supportPlan: account.contract.supportPlan,
          openCases: account.context.openCases
        },
        invoice: {
          risk: account.context.invoiceRisk
        },
        usage: {
          trend: account.context.usageTrend,
          healthScore: account.context.healthScore
        },
        shipment: {
          status: "delayed",
          priority: "expedite"
        },
        regulatory: {
          complianceFlags: structuredClone(account.context.complianceFlags),
          legalReview: true
        },
        audit: {
          timeline: auditEvents.map(({ _id, eventType, summary, occurredAt, customerVisible }) => ({
            _id,
            eventType,
            summary,
            occurredAt,
            customerVisible
          }))
        }
      },
      routing: {
        ownerGroups,
        coordinationGroups: ["Customer Success", "Legal", "Finance", "Support"],
        executiveRecoveryOwner: "Executive Sponsor"
      }
    }
  ];

  db.owner_tasks = ownerGroups.map((ownerGroup, index) => ({
    _id: `owner-task-${request._id}-${slugify(ownerGroup)}`,
    requestId: request._id,
    accountId: account._id,
    ownerGroup,
    title: taskTitle(ownerGroup, account.name),
    dueAt: new Date(Date.parse(now) + (index + 1) * 2 * 60 * 60 * 1000).toISOString(),
    status: "open",
    priority: index === 0 ? "urgent" : "high"
  }));

  db.customer_messages = [
    {
      _id: `customer-message-${request._id}`,
      requestId: request._id,
      accountId: account._id,
      channel: "portal",
      body: "We have activated the recovery plan for your order and are coordinating updates through the portal.",
      customerVisible: true,
      createdAt: now
    }
  ];

  db.audit_events = auditEvents;

  return buildPortalView(db);
}

function taskTitle(ownerGroup, accountName) {
  switch (ownerGroup) {
    case "Customer Success":
      return `Coordinate recovery for ${accountName}`;
    case "Support":
      return `Track shipment and support updates for ${accountName}`;
    case "Finance":
      return `Review invoice risk and billing exposure for ${accountName}`;
    default:
      return `Approve executive recovery path for ${accountName}`;
  }
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "task";
}
