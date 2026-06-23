import { buildPortalView } from "./portal-view.mjs";

const CUSTOMER_SAFE_STATUS = "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests?.[0];
  if (!request) {
    return buildPortalView(db);
  }

  const account = (db.accounts || []).find((item) => item._id === request.accountId);
  const activities = (db.activities || [])
    .filter((item) => item.subjectId === request._id)
    .slice()
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const riskSignals = (request.riskSignals || []).map((item) => ({ ...item }));
  const timestamp = new Date(now).toISOString();

  const customerMessage = {
    _id: `customer-message-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    audience: "customer",
    visibility: "customer-safe",
    body: "We have activated an at-risk escalation for your delayed order. Recovery work is underway, and portal updates will stay customer-safe and visible here.",
    customerVisible: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const auditEvent = {
    _id: `audit-event-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    eventType: "customer-visible-escalation-activated",
    summary: CUSTOMER_SAFE_STATUS,
    customerVisible: true,
    occurredAt: timestamp,
    actor: "workflow-engine",
    details: {
      accountTier: account?.tier || null,
      contractId: account?.contract?.contractId || null,
      supportPlan: account?.contract?.supportPlan || null,
      invoiceRisk: account?.context?.invoiceRisk || null,
      usageTrend: account?.context?.usageTrend || null,
      shipmentStatus: "delayed",
      regulatoryFlags: [...(account?.context?.complianceFlags || [])],
      riskSignals: riskSignals.map((item) => item.name),
      timelineActivityIds: activities.map((item) => item._id),
      functionalRouting: ["Customer Success", "Legal", "Finance", "Support"]
    }
  };

  const workflowState = {
    _id: `workflow-state-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    taskId: request.taskId,
    title: request.title,
    status: CUSTOMER_SAFE_STATUS,
    customerVisibleStatus: CUSTOMER_SAFE_STATUS,
    internalStatus: "Escalation active",
    ownerRouting: {
      executiveRecoveryOwner: "Executive Sponsor",
      functionalGroups: ["Customer Success", "Legal", "Finance", "Support"],
      taskGroups: request.ownerGroups.slice()
    },
    ownerGroups: request.ownerGroups.slice(),
    nextStep: request.nextStep,
    customerMessage: customerMessage.body,
    customerMessageId: customerMessage._id,
    auditEventId: auditEvent._id,
    customerVisibleHistory: "Audit visible",
    riskSignals,
    context: {
      accountTier: account?.tier || null,
      contract: account?.contract ? { ...account.contract } : null,
      support: {
        plan: account?.contract?.supportPlan || null,
        openCases: account?.context?.openCases ?? null
      },
      invoice: {
        risk: account?.context?.invoiceRisk || null,
        status: account?.context?.invoiceRisk === "high" ? "blocked" : "under review"
      },
      usage: {
        trend: account?.context?.usageTrend || null,
        healthScore: account?.context?.healthScore ?? null
      },
      shipment: {
        status: "delayed",
        priority: "high",
        customerImpact: "open"
      },
      regulatory: {
        flags: [...(account?.context?.complianceFlags || [])],
        legalReview: "required"
      },
      audit: {
        customerVisible: true,
        timelineActivityIds: activities.map((item) => item._id),
        auditEventId: auditEvent._id
      }
    },
    auditTimeline: [
      ...activities.map((item) => ({
        kind: "activity",
        activityId: item._id,
        occurredAt: item.occurredAt,
        summary: item.summary,
        customerVisible: false
      })),
      {
        kind: "audit_event",
        auditEventId: auditEvent._id,
        occurredAt: auditEvent.occurredAt,
        summary: auditEvent.summary,
        customerVisible: true
      }
    ],
    updatedAt: timestamp,
    createdAt: timestamp
  };

  const ownerTaskBlueprints = [
    {
      ownerGroup: "Customer Success",
      title: "Coordinate recovery plan for the delayed strategic order",
      dueOffsetHours: 2
    },
    {
      ownerGroup: "Support",
      title: "Stabilize shipment tracking and customer communications",
      dueOffsetHours: 3
    },
    {
      ownerGroup: "Finance",
      title: "Review invoice exposure and contract risk",
      dueOffsetHours: 4
    },
    {
      ownerGroup: "Executive Sponsor",
      title: "Lead executive recovery owner routing",
      dueOffsetHours: 1
    }
  ];

  const ownerTasks = request.ownerGroups.map((ownerGroup, index) => {
    const blueprint = ownerTaskBlueprints.find((item) => item.ownerGroup === ownerGroup) || {
      ownerGroup,
      title: `Review escalation for ${ownerGroup}`,
      dueOffsetHours: index + 1
    };

    return {
      _id: `owner-task-${request._id}-${index + 1}`,
      requestId: request._id,
      accountId: request.accountId,
      ownerGroup,
      title: blueprint.title,
      dueAt: new Date(Date.parse(timestamp) + blueprint.dueOffsetHours * 60 * 60 * 1000).toISOString(),
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp,
      priority: ownerGroup === "Executive Sponsor" ? "urgent" : "high"
    };
  });

  db.workflow_state = replaceDocuments(db.workflow_state, request._id, workflowState);
  db.owner_tasks = replaceDocuments(db.owner_tasks, request._id, ...ownerTasks);
  db.customer_messages = replaceDocuments(db.customer_messages, request._id, customerMessage);
  db.audit_events = replaceDocuments(db.audit_events, request._id, auditEvent);

  return buildPortalView(db);
}

function replaceDocuments(collection, requestId, ...documents) {
  const list = Array.isArray(collection) ? collection.filter((item) => item.requestId !== requestId) : [];
  list.push(...documents);
  return list;
}
