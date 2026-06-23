import { buildPortalView } from "./portal-view.mjs";

// Recovery SLA per routed owner group, measured in hours from escalation time.
const OWNER_SLA_HOURS = {
  "Customer Success": 4,
  Support: 8,
  Finance: 24,
  "Executive Sponsor": 12
};

const OWNER_TASK_TITLES = {
  "Customer Success": "Lead at-risk account recovery and own customer communication",
  Support: "Resolve the delayed high-value order and clear support blockers",
  Finance: "Review contract, invoice, and credit exposure for the account",
  "Executive Sponsor": "Own executive recovery routing and approve concessions"
};

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const escalatedAt = now ?? new Date().toISOString();
  const dueFrom = (hours) =>
    new Date(new Date(escalatedAt).getTime() + hours * 60 * 60 * 1000).toISOString();

  // Persist the escalation workflow state with the scored risk signals.
  db.workflow_state.push({
    requestId: request._id,
    accountId: request.accountId,
    title: request.title,
    status: request.expectedOutcome,
    nextStep: request.nextStep,
    riskSignals: request.riskSignals.map((signal) => ({ ...signal })),
    escalatedAt
  });

  // Route one open owner task per group, in escalation order.
  for (const ownerGroup of request.ownerGroups) {
    db.owner_tasks.push({
      requestId: request._id,
      ownerGroup,
      title: OWNER_TASK_TITLES[ownerGroup] ?? `Drive recovery actions for ${request.title}`,
      dueAt: dueFrom(OWNER_SLA_HOURS[ownerGroup] ?? 24),
      status: "open"
    });
  }

  // Publish the customer-safe portal message.
  db.customer_messages.push({
    requestId: request._id,
    body: request.customerMessage,
    publishedAt: escalatedAt
  });

  // Record a customer-visible audit event for the recovery timeline.
  db.audit_events.push({
    requestId: request._id,
    type: "escalation.activated",
    summary: `At-risk escalation activated for ${request.title} with executive recovery owner routing.`,
    actor: "workflow:strategic-account-rescue",
    customerVisible: true,
    owners: [...request.ownerGroups],
    riskSignals: request.riskSignals.map((signal) => signal.name),
    occurredAt: escalatedAt
  });

  return buildPortalView(db);
}
