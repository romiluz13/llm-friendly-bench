import { buildPortalView } from "./portal-view.mjs";

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests.find((item) => item.taskId === "strategic-account-rescue") || db.workflow_requests[0];
  const account = db.accounts.find((item) => item._id === request.accountId);
  const activities = db.activities
    .filter((item) => item.subjectId === request._id)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const status = request.expectedOutcome;
  const customerMessage = "We have activated a recovery plan for your delayed order. Customer Success is coordinating the response and we will keep the portal updated with visible progress.";
  const internalRouting = ["Customer Success", "Legal", "Finance", "Support"];
  const ownerGroups = [...request.ownerGroups];
  const workflowState = {
    _id: `${request._id}-workflow-state`,
    requestId: request._id,
    accountId: account._id,
    taskId: request.taskId,
    title: request.title,
    status,
    nextStep: request.nextStep,
    ownerGroups,
    routingGroups: internalRouting,
    recoveryOwner: ownerGroups[0],
    riskSignals: structuredClone(request.riskSignals),
    accountSnapshot: {
      tier: account.tier,
      region: account.region,
      contract: structuredClone(account.contract),
      contacts: structuredClone(account.contacts),
      context: structuredClone(account.context)
    },
    context: {
      support: {
        plan: account.contract.supportPlan,
        openCases: account.context.openCases
      },
      invoice: {
        risk: account.context.invoiceRisk
      },
      usage: {
        trend: account.context.usageTrend
      },
      shipment: {
        status: "delayed",
        priority: "high-value order"
      },
      regulatory: {
        flags: structuredClone(account.context.complianceFlags)
      },
      audit: {
        timeline: activities.map((item) => ({
          _id: item._id,
          summary: item.summary,
          occurredAt: item.occurredAt
        }))
      }
    },
    customerMessage,
    customerVisibleAuditHistory: true,
    escalatedAt: now
  };

  replaceCollectionDocs(db.workflow_state, (item) => item.requestId === request._id, workflowState);

  const ownerTasks = ownerGroups.map((ownerGroup, index) => ({
    _id: `${request._id}-owner-task-${index + 1}`,
    requestId: request._id,
    ownerGroup,
    title: `${ownerGroup} recovery task`,
    dueAt: addHours(now, index + 1),
    status: "open",
    priority: "high",
    createdAt: now
  }));
  replaceCollectionDocs(db.owner_tasks, (item) => item.requestId === request._id, ...ownerTasks);

  const customerMessageDoc = {
    _id: `${request._id}-customer-message`,
    requestId: request._id,
    body: customerMessage,
    audience: "customer",
    status: "ready",
    createdAt: now,
    updatedAt: now
  };
  replaceCollectionDocs(db.customer_messages, (item) => item.requestId === request._id, customerMessageDoc);

  const auditEvent = {
    _id: `${request._id}-audit-event`,
    requestId: request._id,
    eventType: "customer-visible-escalation",
    customerVisible: true,
    summary: status,
    timeline: workflowState.context.audit.timeline,
    createdAt: now
  };
  replaceCollectionDocs(db.audit_events, (item) => item.requestId === request._id, auditEvent);

  return buildPortalView(db);
}

function replaceCollectionDocs(collection, predicate, ...docs) {
  for (let index = collection.length - 1; index >= 0; index -= 1) {
    if (predicate(collection[index])) {
      collection.splice(index, 1);
    }
  }

  collection.push(...docs);
}

function addHours(now, hours) {
  return new Date(new Date(now).getTime() + hours * 60 * 60 * 1000).toISOString();
}
