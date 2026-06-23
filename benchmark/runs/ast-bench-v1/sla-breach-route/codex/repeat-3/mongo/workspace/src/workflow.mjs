import { buildPortalView } from "./portal-view.mjs";

const CUSTOMER_STATUS = "SLA breach escalated with correct owners, customer-safe next step, and timer audit.";
const RESPONSE_HOURS_BY_PLAN = {
  platinum: 1,
  gold: 2,
  silver: 4
};

const RESPONSE_TIMERS_HOURS = [4, 8, 12, 24];

function addHours(iso, hours) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function resolveResponseHours(account) {
  const planHours = RESPONSE_HOURS_BY_PLAN[account?.contract?.supportPlan];
  const base = planHours ?? 4;
  return account?.tier === "enterprise" ? base : base * 2;
}

function replaceForRequest(collection, requestId, doc) {
  return [...collection.filter((item) => item.requestId !== requestId), doc];
}

function formatUtcClock(isoTimestamp) {
  return `${isoTimestamp.slice(11, 16)} UTC`;
}

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId);
  const escalatedAt = new Date(now).toISOString();
  const responseHours = resolveResponseHours(account);

  const openIncidents = db.activities
    .filter((item) => item.subjectId === request._id)
    .map((activity) => ({
      activityId: activity._id,
      summary: activity.summary,
      occurredAt: activity.occurredAt
    }));

  const riskSignals = request.riskSignals.map((signal) => {
    const sourceActivity = db.activities.find(
      (activity) => activity.subjectId === request._id && activity.summary === signal.detail
    );

    return {
      name: signal.name,
      detail: signal.detail,
      sourceActivityId: sourceActivity?._id,
      observedAt: sourceActivity?.occurredAt
    };
  });

  const ownerTasks = request.ownerGroups.map((ownerGroup, index) => {
    const dueAt = addHours(escalatedAt, responseHours * (index + 1));

    return {
      _id: `task-${request._id}-${slugify(ownerGroup)}`,
      requestId: request._id,
      accountId: request.accountId,
      ownerGroup,
      title: `${ownerGroup} response for ${request.title}`,
      status: "open",
      dueAt,
      responseWindowHours: responseHours,
      priority: index === 0 ? "urgent" : "high",
      createdAt: escalatedAt
    };
  });

  const ownerAvailability = ownerTasks.map((task) => ({
    ownerGroup: task.ownerGroup,
    dueAt: task.dueAt,
    available: true,
    status: task.status
  }));

  const responseTimers = ownerTasks.map((task) => ({
    ownerGroup: task.ownerGroup,
    dueAt: task.dueAt,
    responseWindowHours: task.responseWindowHours
  }));

  const nextCustomerUpdateAt = addHours(escalatedAt, RESPONSE_TIMERS_HOURS[0]);
  const nextStep = `Customer update due by ${formatUtcClock(nextCustomerUpdateAt)} after the response check.`;
  const customerMessage = `We have escalated this case and will update you by ${formatUtcClock(nextCustomerUpdateAt)} after the response check.`;

  db.workflow_state = replaceForRequest(db.workflow_state, request._id, {
    _id: `state-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    title: request.title,
    status: CUSTOMER_STATUS,
    nextStep,
    entitlement: {
      tier: account?.tier ?? null,
      supportPlan: account?.contract?.supportPlan ?? null,
      contractId: account?.contract?.contractId ?? null,
      renewalDate: account?.contract?.renewalDate ?? null
    },
    accountTier: account?.tier ?? null,
    openIncidents,
    openIncidentCount: openIncidents.length,
    orderImpact: {
      usageTrend: account?.context?.usageTrend ?? null,
      openCases: account?.context?.openCases ?? null,
      invoiceRisk: account?.context?.invoiceRisk ?? null
    },
    ownerGroups: request.ownerGroups.slice(),
    ownerAvailability,
    responseTimers: {
      breachDetectedAt: escalatedAt,
      customerNextUpdateAt: nextCustomerUpdateAt,
      ownerDueAt: responseTimers
    },
    riskSignals,
    customerVisibleEscalationState: {
      status: CUSTOMER_STATUS,
      nextStep,
      customerSafe: true
    },
    escalationState: {
      customerVisible: true,
      auditTrailVisible: true,
      ownerCount: ownerTasks.length
    },
    escalatedAt,
    updatedAt: escalatedAt
  });

  db.owner_tasks = [
    ...db.owner_tasks.filter((item) => item.requestId !== request._id),
    ...ownerTasks
  ];

  db.customer_messages = replaceForRequest(db.customer_messages, request._id, {
    _id: `msg-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    audience: "customer",
    body: customerMessage,
    nextStep,
    customerSafe: true,
    sentAt: escalatedAt
  });

  const breachDeadline = addHours(escalatedAt, responseHours);
  db.audit_events = replaceForRequest(db.audit_events, request._id, {
    _id: `audit-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    eventType: "sla-breach-escalated",
    customerVisible: true,
    status: CUSTOMER_STATUS,
    owners: request.ownerGroups.slice(),
    timers: responseTimers,
    riskSignals: riskSignals.map((signal) => signal.name),
    breachDeadline,
    summary: `SLA breach escalated at ${escalatedAt} with a ${responseHours}h response window across ${request.ownerGroups.length} owner groups.`,
    recordedAt: escalatedAt
  });

  return buildPortalView(db);
}
