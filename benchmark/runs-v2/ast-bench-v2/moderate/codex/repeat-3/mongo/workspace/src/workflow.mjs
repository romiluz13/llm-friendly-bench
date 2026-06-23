import { buildPortalView } from "./portal-view.mjs";

const ESCALATION_STATUS = "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId);
  const activities = db.activities.filter((item) => item.subjectId === request._id);
  const ownerGroups = [...request.ownerGroups];
  const riskSignals = request.riskSignals.map((item) => ({ ...item }));
  const timestamp = new Date(now).toISOString();
  const dueAt = new Date(new Date(now).getTime() + 4 * 60 * 60 * 1000).toISOString();
  const accountContext = account?.context ?? {};
  const contract = account?.contract ? { ...account.contract } : null;

  db.workflow_state = db.workflow_state || [];
  db.workflow_state = db.workflow_state.filter((item) => item.requestId !== request._id);
  db.workflow_state.push({
    _id: `workflow-state-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    title: request.title,
    status: ESCALATION_STATUS,
    ownerGroups,
    executiveRecoveryOwner: ownerGroups[ownerGroups.length - 1] || "Executive Sponsor",
    nextStep: request.nextStep,
    riskSignals,
    accountTier: account?.tier || "unknown",
    contractId: contract?.contractId || null,
    supportPlan: contract?.supportPlan || null,
    supportContext: {
      contacts: account?.contacts?.map((contact) => ({
        contactId: contact.contactId,
        role: contact.role,
        email: contact.email
      })) || [],
      openCases: accountContext.openCases || 0
    },
    invoiceContext: {
      risk: accountContext.invoiceRisk || "unknown"
    },
    usageContext: {
      trend: accountContext.usageTrend || "unknown",
      healthScore: accountContext.healthScore ?? null
    },
    shipmentContext: {
      status: "delayed",
      priority: "high-value order"
    },
    regulatoryContext: {
      complianceFlags: [...(accountContext.complianceFlags || [])],
      legalReviewRequired: true
    },
    auditContext: {
      activityIds: activities.map((item) => item._id),
      customerVisible: true
    },
    startedAt: timestamp,
    updatedAt: timestamp,
    customerVisible: true
  });

  db.owner_tasks = db.owner_tasks || [];
  db.owner_tasks = db.owner_tasks.filter((item) => item.requestId !== request._id);
  db.owner_tasks.push(
    ...ownerGroups.map((ownerGroup, index) => ({
      _id: `owner-task-${request._id}-${index + 1}`,
      requestId: request._id,
      accountId: request.accountId,
      ownerGroup,
      title: ownerTaskTitle(ownerGroup),
      status: "open",
      dueAt,
      createdAt: timestamp,
      updatedAt: timestamp
    }))
  );

  db.customer_messages = db.customer_messages || [];
  db.customer_messages = db.customer_messages.filter((item) => item.requestId !== request._id);
  db.customer_messages.push({
    _id: `customer-message-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    channel: "portal",
    visibility: "customer-safe",
    body: "Your delayed order is in active recovery with an executive owner. We will keep updates customer-visible in the portal.",
    createdAt: timestamp,
    sentAt: timestamp
  });

  db.audit_events = db.audit_events || [];
  db.audit_events = db.audit_events.filter((item) => item.requestId !== request._id);
  db.audit_events.push({
    _id: `audit-event-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    customerVisible: true,
    eventType: "customer-visible-escalation-activated",
    summary: "Customer-safe escalation recorded with full timeline and executive routing.",
    occurredAt: timestamp,
    timeline: [
      ...activities.map((item) => ({
        kind: "activity",
        summary: item.summary,
        occurredAt: item.occurredAt
      })),
      {
        kind: "workflow-state",
        status: ESCALATION_STATUS,
        occurredAt: timestamp
      }
    ]
  });

  return buildPortalView(db);
}

function ownerTaskTitle(ownerGroup) {
  switch (ownerGroup) {
    case "Customer Success":
      return "Customer Success recovery plan";
    case "Support":
      return "Support shipment and case coordination";
    case "Finance":
      return "Finance invoice and credit review";
    case "Executive Sponsor":
      return "Executive recovery oversight";
    case "Legal":
      return "Legal and regulatory review";
    default:
      return `${ownerGroup} recovery task`;
  }
}
