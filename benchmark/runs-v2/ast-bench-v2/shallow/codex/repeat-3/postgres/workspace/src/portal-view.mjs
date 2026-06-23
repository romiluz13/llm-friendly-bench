export function buildPortalView(tables) {
  const request = tables.workflow_requests[0];
  const state = tables.workflow_state.find((item) => item.request_id === request.request_id);
  const tasks = tables.owner_tasks.filter((item) => item.request_id === request.request_id);
  const auditVisible = tables.audit_events.some((item) => item.request_id === request.request_id && item.customer_visible);
  const message = tables.customer_messages.find((item) => item.request_id === request.request_id);
  const signals = splitDelimited(state?.risk_signals || request.risk_signals).map((entry) => {
    const idx = entry.indexOf(":");
    return { signal_name: idx >= 0 ? entry.slice(0, idx) : entry };
  });

  return {
    taskId: request.task_id,
    title: state?.title || request.title,
    status: state?.status || "Needs work",
    owner: tasks.length ? tasks.map((item) => item.owner_group).join(" + ") : "Unassigned",
    nextStep: state?.next_step || request.next_step || "Waiting for workflow",
    riskSummary: state?.risk_summary || (state ? `${signals.length} signals: ${signals.map((item) => item.signal_name).join(", ")}` : "Risk not scored"),
    tasks: `${tasks.length} owner tasks`,
    history: auditVisible ? "Audit visible" : "Not visible",
    customerMessage: message?.body || state?.customer_message || request.customer_message || "No customer-safe message"
  };
}

function splitDelimited(value) {
  return (value ? String(value).split("|") : []).map((item) => item.trim()).filter(Boolean);
}
