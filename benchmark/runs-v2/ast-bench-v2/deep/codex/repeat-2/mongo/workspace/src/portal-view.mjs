export function buildPortalView(db) {
  const request = (db.workflow_requests || [])[0];
  if (!request) {
    return {
      taskId: "unknown",
      title: "Unknown",
      status: "Needs work",
      owner: "Unassigned",
      nextStep: "Waiting for workflow",
      riskSummary: "Risk not scored",
      tasks: "0 owner tasks",
      history: "Not visible",
      customerMessage: "No customer-safe message"
    };
  }

  const workflowStates = Array.isArray(db.workflow_state) ? db.workflow_state : [];
  const ownerTasks = Array.isArray(db.owner_tasks) ? db.owner_tasks : [];
  const auditEvents = Array.isArray(db.audit_events) ? db.audit_events : [];
  const customerMessages = Array.isArray(db.customer_messages) ? db.customer_messages : [];
  const state = workflowStates.find((item) => item.requestId === request._id);
  const tasks = ownerTasks.filter((item) => item.requestId === request._id);
  const auditVisible = auditEvents.some((item) => item.requestId === request._id && item.customerVisible);
  const message = customerMessages.find((item) => item.requestId === request._id);

  return {
    taskId: request.taskId,
    title: state?.title || request.title,
    status: state?.customerVisibleStatus || state?.status || "Needs work",
    owner: tasks.length ? tasks.map((item) => item.ownerGroup).join(" + ") : "Unassigned",
    nextStep: state?.nextStep || "Waiting for workflow",
    riskSummary: state?.riskSignals?.length ? `${state.riskSignals.length} signals: ${state.riskSignals.map((item) => item.name).join(", ")}` : "Risk not scored",
    tasks: `${tasks.length} owner tasks`,
    history: state?.customerVisibleHistory || (auditVisible ? "Audit visible" : "Not visible"),
    customerMessage: message?.body || "No customer-safe message"
  };
}
