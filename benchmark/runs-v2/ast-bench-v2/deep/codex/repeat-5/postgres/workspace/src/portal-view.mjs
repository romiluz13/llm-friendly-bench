export function buildPortalView(tables) {
  const request = tables.workflow_requests[0];
  const state = lastMatching(tables.workflow_state, (item) => item.request_id === request.request_id);
  const tasks = tables.owner_tasks.filter((item) => item.request_id === request.request_id);
  const auditVisible = tables.audit_events.some((item) => item.request_id === request.request_id && item.customer_visible);
  const message = lastMatching(tables.customer_messages, (item) => item.request_id === request.request_id);
  const signals = tables.workflow_request_risk_signals
    .filter((item) => item.request_id === request.request_id)
    .sort((a, b) => a.signal_order - b.signal_order);
  const orderedTasks = [...tasks].sort((a, b) => Number(a.group_order || 0) - Number(b.group_order || 0));

  return {
    taskId: request.task_id,
    title: state?.title || request.title,
    status: state?.status || "Needs work",
    owner: orderedTasks.length ? orderedTasks.map((item) => item.owner_group).join(" + ") : "Unassigned",
    nextStep: state?.next_step || "Waiting for workflow",
    riskSummary: state ? `${signals.length} signals: ${signals.map((item) => item.signal_name).join(", ")}` : "Risk not scored",
    tasks: `${orderedTasks.length} owner tasks`,
    history: auditVisible ? "Audit visible" : "Not visible",
    customerMessage: message?.body || "No customer-safe message"
  };
}

function lastMatching(rows, predicate) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (predicate(rows[index])) {
      return rows[index];
    }
  }

  return undefined;
}
