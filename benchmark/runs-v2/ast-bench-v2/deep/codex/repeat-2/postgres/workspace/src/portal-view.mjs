export function buildPortalView(tables) {
  const request = Array.isArray(tables.workflow_requests) ? tables.workflow_requests[0] : null;
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

  const workflowStates = Array.isArray(tables.workflow_state) ? tables.workflow_state : [];
  const ownerTasks = Array.isArray(tables.owner_tasks) ? tables.owner_tasks : [];
  const auditEvents = Array.isArray(tables.audit_events) ? tables.audit_events : [];
  const customerMessages = Array.isArray(tables.customer_messages) ? tables.customer_messages : [];
  const riskSignals = Array.isArray(tables.workflow_request_risk_signals) ? tables.workflow_request_risk_signals : [];
  const state = workflowStates.find((item) => item.request_id === request.request_id);
  const tasks = ownerTasks.filter((item) => item.request_id === request.request_id);
  const auditVisible = auditEvents.some((item) => item.request_id === request.request_id && item.customer_visible);
  const message = customerMessages.find((item) => item.request_id === request.request_id);
  const signals = state?.risk_signals?.length
    ? state.risk_signals
    : riskSignals.filter((item) => item.request_id === request.request_id).sort((a, b) => a.signal_order - b.signal_order);

  return {
    taskId: request.task_id,
    title: state?.title || request.title,
    status: state?.customer_visible_status || state?.status || "Needs work",
    owner: tasks.length ? tasks.map((item) => item.owner_group).join(" + ") : "Unassigned",
    nextStep: state?.next_step || request.next_step || "Waiting for workflow",
    riskSummary: signals.length ? `${signals.length} signals: ${signals.map((item) => item.signal_name).join(", ")}` : "Risk not scored",
    tasks: `${tasks.length} owner tasks`,
    history: state?.customer_visible_history || (auditVisible ? "Audit visible" : "Not visible"),
    customerMessage: message?.body || state?.customer_message || "No customer-safe message"
  };
}
