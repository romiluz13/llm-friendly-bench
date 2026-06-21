export function buildPortalView(tables, orderId) {
  const order = tables.orders.find((item) => item.order_id === orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  const account = tables.accounts.find((item) => item.account_id === order.account_id);
  const supportCase = tables.support_cases.find((item) => item.order_id === orderId) ||
    tables.support_cases.find((item) => item.account_id === order.account_id && item.status !== "closed");
  const escalation = tables.customer_escalations.find((item) => item.order_id === orderId);
  const ownerGroups = tables.escalation_tasks
    .filter((item) => item.escalation_id === escalation?.escalation_id)
    .map((item) => item.owner_group);
  const riskFactors = tables.escalation_risk_factors
    .filter((item) => item.escalation_id === escalation?.escalation_id)
    .sort((a, b) => a.factor_order - b.factor_order);
  const portalMessage = tables.customer_portal_messages.find((item) => item.escalation_id === escalation?.escalation_id);
  const auditVisible = tables.audit_events.some((item) =>
    item.customer_visible &&
    (item.subject_id === escalation?.escalation_id ||
      tables.audit_subjects.some((subject) => subject.audit_id === item.audit_id && subject.subject_id === orderId))
  );

  return {
    orderId,
    accountId: account?.account_id,
    accountName: account?.name,
    caseId: supportCase?.case_id,
    title: escalation?.customer_visible_title || (order.current_status === "delayed" ? "Shipment delayed" : "Order in progress"),
    status: escalation?.customer_visible_status || order.current_status,
    owner: ownerGroups.length ? ownerGroups.join(" + ") : "Unassigned",
    nextStep: escalation?.next_step || "Contact support",
    history: auditVisible ? "Audit visible" : "Not visible",
    riskSummary: riskFactors.length ? `${riskFactors.length} signals: ${riskFactors.map((item) => item.factor).join(", ")}` : "Risk not scored",
    tasks: `${ownerGroups.length} owner tasks`,
    customerMessage: portalMessage?.body || escalation?.customer_message || "Contact support"
  };
}
