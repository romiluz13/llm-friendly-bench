import { createHash } from "node:crypto";
import { buildPortalView } from "./portal-view.mjs";

const READY_STATUS = "Audit export ready with scoped records, approvers, customer-safe summary, and hashable audit trail.";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests?.[0];

  if (!request) {
    throw new Error("workflow request missing");
  }

  const account = db.accounts?.find((item) => item._id === request.accountId);
  const activities = (db.activities ?? []).filter((item) => item.accountId === request.accountId);
  const ownerGroups = request.ownerGroups ?? [];
  const riskSignals = (request.riskSignals ?? []).map((signal) => ({ ...signal }));
  const scopedRecords = buildScopedRecords(account, activities);
  const auditTrailHash = createHash("sha256").update(JSON.stringify({
    requestId: request._id,
    accountId: account?._id ?? request.accountId,
    ownerGroups,
    riskSignals: riskSignals.map((signal) => signal.name),
    scopedRecordIds: scopedRecords.map((record) => record._id),
    status: request.expectedOutcome ?? READY_STATUS,
    now
  })).digest("hex");
  const customerSafeSummary = buildCustomerSafeSummary(account, scopedRecords.length, ownerGroups.length, auditTrailHash);
  const nextStep = `Complete customer delivery after ${ownerGroups.join(", ")} sign-off and archive the verification hash.`;

  upsertSingle(db.workflow_state, (item) => item.requestId === request._id, () => ({
    _id: `${request._id}-state`,
    requestId: request._id,
    accountId: account?._id ?? request.accountId,
    title: request.title,
    status: request.expectedOutcome ?? READY_STATUS,
    nextStep,
    riskSignals,
    approvers: ownerGroups.slice(),
    approvalHistory: ownerGroups.map((group, index) => ({
      group,
      status: "requested",
      order: index + 1,
      recordedAt: now
    })),
    customerSafeSummary,
    customerMessage: customerSafeSummary,
    scopedRecords,
    scopedRecordCount: scopedRecords.length,
    exportStatus: "ready",
    auditTrailHash,
    updatedAt: now
  }));

  replaceCollection(db.owner_tasks, (item) => item.requestId === request._id, ownerGroups.map((group, index) => ({
    _id: `${request._id}-task-${index + 1}`,
    requestId: request._id,
    accountId: account?._id ?? request.accountId,
    ownerGroup: group,
    title: `${group} review for ${request.title}`,
    summary: `Review the scoped export package for ${account?.name ?? "the account"} and confirm the hashable trail.`,
    status: "open",
    dueAt: addHours(now, 24 + (index * 6)),
    createdAt: now,
    priority: index === 0 ? "high" : "normal",
    taskType: "approval"
  })));

  upsertSingle(db.customer_messages, (item) => item.requestId === request._id, () => ({
    _id: `${request._id}-customer-message`,
    requestId: request._id,
    accountId: account?._id ?? request.accountId,
    body: customerSafeSummary,
    channel: "customer-portal",
    audience: "customer",
    status: "ready",
    createdAt: now
  }));

  upsertSingle(db.audit_events, (item) => item.requestId === request._id, () => ({
    _id: `${request._id}-audit-event`,
    requestId: request._id,
    accountId: account?._id ?? request.accountId,
    customerVisible: true,
    eventType: "audit-export-ready",
    summary: `Customer-safe export ready for ${account?.name ?? "the account"}.`,
    scopedRecordCount: scopedRecords.length,
    auditTrailHash,
    occurredAt: now
  }));

  return buildPortalView(db);
}

function buildScopedRecords(account, activities) {
  const records = [];

  if (account) {
    records.push({
      _id: account._id,
      collection: "accounts",
      name: account.name,
      tier: account.tier,
      region: account.region,
      contractId: account.contract?.contractId,
      contactCount: account.contacts?.length ?? 0
    });
  }

  for (const activity of activities) {
    records.push({
      _id: activity._id,
      collection: "activities",
      accountId: activity.accountId,
      subjectId: activity.subjectId,
      summary: activity.summary,
      occurredAt: activity.occurredAt
    });
  }

  return records;
}

function buildCustomerSafeSummary(account, scopedRecordCount, approverCount, auditTrailHash) {
  const subject = account?.name ?? "The account";
  return `${subject} audit export is ready with ${scopedRecordCount} scoped records, ${approverCount} approver groups, and a verification hash (${auditTrailHash.slice(0, 12)}...).`;
}

function addHours(now, hours) {
  return new Date(new Date(now).getTime() + (hours * 60 * 60 * 1000)).toISOString();
}

function upsertSingle(collection, predicate, create) {
  const index = collection.findIndex(predicate);
  const next = create();

  if (index >= 0) {
    collection[index] = next;
    return next;
  }

  collection.push(next);
  return next;
}

function replaceCollection(collection, predicate, entries) {
  for (let index = collection.length - 1; index >= 0; index -= 1) {
    if (predicate(collection[index])) {
      collection.splice(index, 1);
    }
  }

  collection.push(...entries);
  return entries;
}
