export function buildPortalView(db) {
  const request = db.workflow_requests[0];
  const state = db.workflow_state.find((item) => item.requestId === request._id);
  const tasks = db.owner_tasks.filter((item) => item.requestId === request._id);
  const auditVisible = db.audit_events.some((item) => item.requestId === request._id && item.customerVisible);
  const message = db.customer_messages.find((item) => item.requestId === request._id);

  return {
    taskId: request.taskId,
    title: state?.title || request.title,
    status: state?.status || "Needs work",
    owner: tasks.length ? tasks.map((item) => item.ownerGroup).join(" + ") : "Unassigned",
    nextStep: state?.nextStep || "Waiting for workflow",
    riskSummary: state?.riskSignals?.length ? `${state.riskSignals.length} signals: ${state.riskSignals.map((item) => item.name).join(", ")}` : "Risk not scored",
    tasks: `${tasks.length} owner tasks`,
    history: auditVisible ? "Audit visible" : "Not visible",
    customerMessage: message?.body || "No customer-safe message"
  };
}
