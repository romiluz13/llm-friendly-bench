import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const requestId = request._id;
  const account = db.accounts.find((item) => item._id === request.accountId);
  const tier = account?.tier ? `${account.tier} account` : "strategic account";

  db.workflow_state.push({
    requestId,
    title: request.title,
    status: request.expectedOutcome,
    nextStep: `${request.nextStep} — escalate ${tier} recovery across ${request.ownerGroups.join(", ")}`,
    riskSignals: request.riskSignals
  });

  request.ownerGroups.forEach((ownerGroup) => {
    db.owner_tasks.push({
      requestId,
      ownerGroup,
      title: `${ownerGroup} recovery actions for ${request.title} (${tier})`,
      dueAt: now,
      status: "open"
    });
  });

  db.customer_messages.push({
    requestId,
    body: `${request.customerMessage} A full customer-visible audit trail is being maintained.`
  });

  db.audit_events.push({
    requestId,
    type: "escalation-activated",
    occurredAt: now,
    detail: `At-risk escalation routed to ${request.ownerGroups.join(", ")} for ${request.title}.`,
    customerVisible: true
  });

  return buildPortalView(db);
}
