import { buildPortalView } from "./portal-view.mjs";

// Staggered SLA response timers (hours from escalation) per owner group.
const RESPONSE_TIMERS_HOURS = [4, 8, 12, 24];

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId);

  const riskSignals = request.riskSignals.map((signal) => ({
    name: signal.name,
    detail: signal.detail
  }));

  const ownerTasks = request.ownerGroups.map((ownerGroup, index) => ({
    requestId: request._id,
    accountId: request.accountId,
    ownerGroup,
    title: `${ownerGroup} response for ${request.title}`,
    status: "open",
    dueAt: addHours(now, RESPONSE_TIMERS_HOURS[index] ?? 24),
    createdAt: now
  }));

  db.workflow_state = replaceForRequest(db.workflow_state, request._id, {
    requestId: request._id,
    accountId: request.accountId,
    title: request.title,
    status: request.expectedOutcome,
    nextStep: request.nextStep,
    riskSignals,
    entitlement: {
      tier: account?.tier ?? null,
      supportPlan: account?.contract?.supportPlan ?? null,
      openCases: account?.context?.openCases ?? null
    },
    updatedAt: now
  });

  db.owner_tasks = [
    ...db.owner_tasks.filter((item) => item.requestId !== request._id),
    ...ownerTasks
  ];

  db.customer_messages = replaceForRequest(db.customer_messages, request._id, {
    requestId: request._id,
    accountId: request.accountId,
    body: request.customerMessage,
    nextStep: request.nextStep,
    sentAt: now
  });

  db.audit_events = replaceForRequest(db.audit_events, request._id, {
    requestId: request._id,
    accountId: request.accountId,
    event: "sla-breach-escalated",
    customerVisible: true,
    timers: ownerTasks.map((task) => ({ ownerGroup: task.ownerGroup, dueAt: task.dueAt })),
    riskSignals: riskSignals.map((signal) => signal.name),
    recordedAt: now
  });

  return buildPortalView(db);
}

function replaceForRequest(collection, requestId, doc) {
  return [...collection.filter((item) => item.requestId !== requestId), doc];
}

function addHours(iso, hours) {
  return new Date(new Date(iso).getTime() + hours * 3600 * 1000).toISOString();
}
