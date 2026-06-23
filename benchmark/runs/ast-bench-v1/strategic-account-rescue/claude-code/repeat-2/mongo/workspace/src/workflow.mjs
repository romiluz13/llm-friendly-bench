import { buildPortalView } from "./portal-view.mjs";

const OWNER_TASK_PLAYBOOK = {
  "Customer Success": "Own executive recovery plan and customer communication cadence",
  "Support": "Drive technical resolution of the delayed high-value order",
  "Finance": "Review invoice exposure and contract remedies for the strategic account",
  "Executive Sponsor": "Sponsor the rescue and approve customer-visible commitments"
};

const TASK_DUE_OFFSET_HOURS = 4;

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId);
  const escalatedAt = now;
  const dueAt = addHours(now, TASK_DUE_OFFSET_HOURS);

  // Persist the at-risk escalation workflow state next to the customer record.
  const state = {
    _id: `state-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    taskId: request.taskId,
    title: request.title,
    status: request.expectedOutcome,
    nextStep: request.nextStep,
    ownerGroups: [...request.ownerGroups],
    riskSignals: request.riskSignals.map((signal) => ({
      name: signal.name,
      detail: signal.detail
    })),
    accountTier: account?.tier ?? null,
    healthScore: account?.context?.healthScore ?? null,
    escalatedAt,
    updatedAt: now
  };
  db.workflow_state.push(state);

  // Route one owner task per recovery group, preserving routing order.
  for (const ownerGroup of request.ownerGroups) {
    db.owner_tasks.push({
      _id: `task-${request._id}-${slug(ownerGroup)}`,
      requestId: request._id,
      accountId: request.accountId,
      ownerGroup,
      title: OWNER_TASK_PLAYBOOK[ownerGroup] || `${ownerGroup} recovery action for ${request.title}`,
      status: "open",
      createdAt: now,
      dueAt
    });
  }

  // Customer-safe portal message.
  db.customer_messages.push({
    _id: `msg-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    audience: "customer",
    body: request.customerMessage,
    createdAt: now
  });

  // Customer-visible audit timeline entry.
  db.audit_events.push({
    _id: `audit-${request._id}`,
    requestId: request._id,
    accountId: request.accountId,
    type: "escalation.activated",
    actor: "system",
    summary: `At-risk escalation activated and routed to ${request.ownerGroups.join(", ")}.`,
    customerVisible: true,
    riskSignalCount: request.riskSignals.length,
    occurredAt: now
  });

  return buildPortalView(db);
}

function addHours(iso, hours) {
  const base = new Date(iso);
  base.setUTCHours(base.getUTCHours() + hours);
  return base.toISOString();
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
