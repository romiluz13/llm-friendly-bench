import { buildPortalView } from "./portal-view.mjs";

const HOUR_MS = 60 * 60 * 1000;

// At-risk customer escalation for a delayed high-value order at a strategic
// account. Reconstructs the account/contract/usage/audit context, routes the
// recovery owner groups, and persists a document-native workflow record set.
export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId);

  // Carry the full risk picture (tier, contract, support, invoice, usage,
  // shipment, regulatory, audit) into the escalation state.
  const riskSignals = request.riskSignals.map((signal) => ({
    name: signal.name,
    detail: signal.detail
  }));

  // Owner tasks routed in priority order, due the same business day.
  const dueAt = new Date(new Date(now).getTime() + 4 * HOUR_MS).toISOString();
  const ownerTasks = request.ownerGroups.map((ownerGroup) => ({
    requestId: request._id,
    ownerGroup,
    title: `${ownerGroup}: ${request.title}`,
    dueAt,
    status: "open",
    createdAt: now
  }));

  replaceForRequest(db.workflow_state, request._id, [
    {
      requestId: request._id,
      accountId: request.accountId,
      title: request.title,
      status: request.expectedOutcome,
      nextStep: request.nextStep,
      riskSignals,
      recoveryOwner: "Executive Sponsor",
      healthScore: account?.context?.healthScore ?? null,
      openedAt: now
    }
  ]);

  replaceForRequest(db.owner_tasks, request._id, ownerTasks);

  replaceForRequest(db.customer_messages, request._id, [
    {
      requestId: request._id,
      channel: "portal",
      body: request.customerMessage,
      sentAt: now
    }
  ]);

  replaceForRequest(db.audit_events, request._id, [
    {
      requestId: request._id,
      type: "escalation.opened",
      summary: request.expectedOutcome,
      owners: request.ownerGroups,
      signals: riskSignals.map((item) => item.name),
      customerVisible: true,
      recordedAt: now
    }
  ]);

  return buildPortalView(db);
}

// Idempotent persistence: clear any prior records for this request, then insert.
function replaceForRequest(collection, requestId, records) {
  for (let index = collection.length - 1; index >= 0; index -= 1) {
    if (collection[index].requestId === requestId) {
      collection.splice(index, 1);
    }
  }
  collection.push(...records);
}
