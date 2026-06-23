export function buildPortalView(tables) {
  const request = tables.workflow_requests[0];
  if (!request) {
    return {
      taskId: "unknown",
      title: "Unknown request",
      status: "Needs work",
      owner: "Unassigned",
      nextStep: "Waiting for workflow",
      riskSummary: "Risk not scored",
      tasks: "0 owner tasks",
      history: "Not visible",
      customerMessage: "No customer-safe message"
    };
  }
  const state = tables.workflow_state.find((item) => item.request_id === request.request_id);
  const tasks = tables.owner_tasks
    .filter((item) => item.request_id === request.request_id)
    .slice()
    .sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0) || a.owner_group.localeCompare(b.owner_group));
  const auditVisible = tables.audit_events.some((item) => item.request_id === request.request_id && item.customer_visible);
  const message = tables.customer_messages.find((item) => item.request_id === request.request_id);
  const signals = tables.workflow_request_risk_signals
    .filter((item) => item.request_id === request.request_id)
    .sort((a, b) => a.signal_order - b.signal_order);

  return {
    taskId: request.task_id,
    title: state?.title || request.title,
    status: state?.status || "Needs work",
    owner: tasks.length ? tasks.map((item) => item.owner_group).join(" + ") : state?.owner_routing || "Unassigned",
    nextStep: state?.next_step || "Waiting for workflow",
    riskSummary: state ? `${signals.length} signals: ${signals.map((item) => item.signal_name).join(", ")}` : "Risk not scored",
    tasks: `${tasks.length} owner tasks`,
    history: auditVisible ? "Audit visible" : "Not visible",
    customerMessage: message?.body || "No customer-safe message"
  };
}
