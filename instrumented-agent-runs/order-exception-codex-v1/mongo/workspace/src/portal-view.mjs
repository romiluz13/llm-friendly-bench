export function buildPortalView(db, orderId) {
  const order = db.orders.find((item) => item._id === orderId);
  if (!order) throw new Error(`Order not found: ${orderId}`);
  const account = db.accounts.find((item) => item._id === order.accountId);
  const supportCase = db.support_cases.find((item) => item.orderId === orderId) ||
    db.support_cases.find((item) => item.accountId === order.accountId && item.status !== "closed");
  const escalation = account?.currentEscalation ||
    db.customer_escalations.find((item) => item.orderId === orderId);
  const tasks = db.work_items.filter((item) => item.escalationId === escalation?.escalationId);
  const auditVisible = db.audit_events.some((item) =>
    item.customerVisible &&
    (item.orderId === orderId || item.escalationId === escalation?.escalationId || item.subject?.id === escalation?.escalationId)
  );

  return {
    orderId,
    accountId: account?._id,
    accountName: account?.name,
    caseId: supportCase?.caseId,
    title: escalation?.customerVisibleTitle || order.exception?.customerTitle || (order.status === "delayed" ? "Shipment delayed" : "Order in progress"),
    status: escalation?.customerVisibleStatus || order.exception?.customerStatus || order.status,
    owner: escalation?.ownerGroups?.join(" + ") || order.exception?.ownerGroups?.join(" + ") || "Unassigned",
    nextStep: escalation?.nextStep || order.exception?.nextStep || "Contact support",
    history: auditVisible ? "Audit visible" : "Not visible",
    riskSummary: escalation?.riskFactors?.length
      ? `${escalation.riskFactors.length} signals: ${escalation.riskFactors.map((item) => item.factor).join(", ")}`
      : "Risk not scored",
    tasks: `${tasks.length} owner tasks`,
    customerMessage: escalation?.customerMessage || "Contact support"
  };
}
