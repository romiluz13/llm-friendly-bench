import { buildPortalView } from "./portal-view.mjs";

const CUSTOMER_STATUS = "SLA breach escalated with correct owners, customer-safe next step, and timer audit.";
const RESPONSE_TIMERS_HOURS = [4, 8, 12, 24];

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId);
  const activities = db.activities
    .filter((item) => item.accountId === request.accountId && item.subjectId === request._id)
    .slice()
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const ownerGroups = [...request.ownerGroups];
  const riskSignals = request.riskSignals.map((signal) => {
    const activity = activities.find((item) => item.summary === signal.detail);

    return {
      name: signal.name,
      detail: signal.detail,
      sourceActivityId: activity?._id ?? null,
      observedAt: activity?.occurredAt ?? null
    };
  });
  const ownerTasks = ownerGroups.map((ownerGroup, index) => {
    const dueAt = addHours(now, RESPONSE_TIMERS_HOURS[index] ?? RESPONSE_TIMERS_HOURS[RESPONSE_TIMERS_HOURS.length - 1]);

    return {
      _id: `owner-task-${request._id}-${index + 1}`,
      requestId: request._id,
      accountId: request.accountId,
      ownerGroup,
      title: `${ownerGroup} response for ${request.title}`,
      status: "open",
      dueAt,
      priority: index === 0 ? "urgent" : "high",
      createdAt: now
    };
  });
  const nextCustomerUpdateAt = addHours(now, RESPONSE_TIMERS_HOURS[0]);
  const customerMessageBody = `We have escalated this case and will update you by ${formatUtcClock(nextCustomerUpdateAt)} after the response check.`;
  const workflowState = {
    _id: `workflow-state-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    taskId: request.taskId,
    title: request.title,
    status: CUSTOMER_STATUS,
    nextStep: `Customer update due by ${formatUtcClock(nextCustomerUpdateAt)} after the response check.`,
    riskSignals,
    entitlement: {
      tier: account?.tier ?? null,
      supportPlan: account?.contract?.supportPlan ?? null,
      renewalDate: account?.contract?.renewalDate ?? null,
      arrCents: account?.contract?.arrCents ?? null
    },
    openIncidents: {
      count: account?.context?.openCases ?? 0,
      activityCount: activities.length,
      latestActivityAt: activities.length ? activities[activities.length - 1].occurredAt : now
    },
    orderImpact: {
      severity: account?.context?.usageTrend === "down" ? "elevated" : "standard",
      customerImpact: "open customer impact",
      invoiceRisk: account?.context?.invoiceRisk ?? null
    },
    ownerAvailability: ownerTasks.map((task) => ({
      ownerGroup: task.ownerGroup,
      status: "assigned",
      dueAt: task.dueAt
    })),
    responseTimers: {
      breachDetectedAt: now,
      customerNextUpdateAt: nextCustomerUpdateAt,
      ownerDueAt: ownerTasks.map((task) => ({ ownerGroup: task.ownerGroup, dueAt: task.dueAt }))
    },
    escalationState: {
      customerVisible: true,
      auditTrailVisible: true,
      ownerCount: ownerTasks.length
    },
    customerVisible: true,
    customerMessage: customerMessageBody,
    activityTimeline: activities.map((item) => ({
      activityId: item._id,
      summary: item.summary,
      occurredAt: item.occurredAt
    })),
    updatedAt: now
  };

  db.workflow_state = replaceForRequest(db.workflow_state, request._id, workflowState);
  db.owner_tasks = replaceForRequest(db.owner_tasks, request._id, ...ownerTasks);
  db.customer_messages = replaceForRequest(db.customer_messages, request._id, {
    _id: `customer-message-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    channel: "portal",
    body: customerMessageBody,
    nextStep: workflowState.nextStep,
    customerVisible: true,
    customerSafe: true,
    createdAt: now
  });
  db.audit_events = replaceForRequest(db.audit_events, request._id, {
    _id: `audit-event-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    event: "sla-breach-escalated",
    eventType: "sla-breach-escalated",
    summary: CUSTOMER_STATUS,
    description: CUSTOMER_STATUS,
    customerVisible: true,
    customerSafe: true,
    occurredAt: now,
    ownerGroups,
    riskSignals,
    timerAudit: {
      breachDetectedAt: now,
      customerNextUpdateAt: nextCustomerUpdateAt,
      ownerDueAt: ownerTasks.map((task) => ({ ownerGroup: task.ownerGroup, dueAt: task.dueAt }))
    }
  });

  return buildPortalView(db);
}

function replaceForRequest(collection, requestId, ...documents) {
  return [
    ...collection.filter((item) => item.requestId !== requestId),
    ...documents
  ];
}

function addHours(isoTimestamp, hours) {
  return new Date(new Date(isoTimestamp).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function formatUtcClock(isoTimestamp) {
  return `${isoTimestamp.slice(11, 16)} UTC`;
}
