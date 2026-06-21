export const postgresTouchedFiles = [
  "targets/postgres-app/src/order-exception-workflow.mjs",
  "targets/postgres-app/schema/design.json",
  "targets/postgres-app/schema/schema.sql",
  "data/generated/postgres/tables.json",
  "targets/shared/portal-view.mjs",
  "targets/shared/acceptance.mjs",
  "prototypes/lab-console/replays/order-exception-codex-v1-candidate.json"
];

const expectedRiskFactors = [
  ["shipment delay", "Delayed high-value shipment is still unresolved."],
  ["strategic account", "Strategic tier account with enterprise-plus contract."],
  ["open support case", "Open urgent or high-priority support case exists."],
  ["invoice risk", "Past-due invoice or payment hold risk is active."],
  ["usage drop", "Recent usage dropped from the previous seven-day window."],
  ["regulatory review", "Regulated shipment or compliance review is still active."]
];

export function applyPostgresOrderException(tables, orderId, now) {
  const order = tables.orders.find((item) => item.order_id === orderId);
  if (!order) throw new Error(`Postgres order not found: ${orderId}`);

  const account = tables.accounts.find((item) => item.account_id === order.account_id);
  const contract = tables.account_contracts.find((item) => item.account_id === order.account_id);
  const shipment = tables.shipments.find((item) => item.order_id === orderId);
  const policy = tables.escalation_policies.find((item) => item.policy_id === "policy-strategic-customer-360-escalation");
  if (!policy) throw new Error("Postgres escalation policy not found");

  const supportCases = tables.support_cases.filter((item) => item.account_id === order.account_id && item.status !== "closed");
  const invoiceRisks = tables.invoices.filter((item) => item.account_id === order.account_id && (item.status === "past_due" || item.risk));
  const usage = tables.usage_snapshots.find((item) => item.account_id === order.account_id && item.trend === "down");
  const compliance = tables.compliance_reviews.find((item) =>
    item.account_id === order.account_id &&
    (item.order_id === orderId || item.status !== "cleared") &&
    item.status !== "cleared"
  );
  const shipmentFlags = tables.shipment_regulatory_flags
    .filter((item) => item.shipment_id === shipment?.shipment_id)
    .map((item) => item.flag);
  const accountFlags = tables.account_risk_flags
    .filter((item) => item.account_id === order.account_id)
    .map((item) => item.risk_flag);
  const isStrategic = ["strategic", "enterprise"].includes(account?.tier_id) && contract?.arr_cents >= 5000000;
  const qualifies = Boolean(
    order.current_status === policy.applies_to_status &&
    order.value_cents >= policy.min_value_cents &&
    shipment?.delayed &&
    isStrategic &&
    supportCases.length &&
    invoiceRisks.length &&
    usage &&
    (shipmentFlags.includes("regulated-shipping") || accountFlags.includes("regulated-shipping") || compliance)
  );

  if (!qualifies) return buildPostgresPortalView(tables, orderId);

  const escalationId = `esc-${orderId}`;
  const ownerGroups = tables.escalation_policy_steps
    .filter((item) => item.policy_id === policy.policy_id)
    .sort((a, b) => a.step_order - b.step_order)
    .map((item) => item.owner_group);

  order.current_status = "customer_escalation_active";
  tables.customer_escalations.push({
    escalation_id: escalationId,
    account_id: order.account_id,
    order_id: orderId,
    policy_id: policy.policy_id,
    status: "active",
    customer_visible_title: policy.customer_visible_title,
    customer_visible_status: policy.customer_visible_status,
    next_step: policy.next_step,
    customer_message: policy.customer_message,
    created_at: now
  });
  expectedRiskFactors.forEach(([factor, detail], index) => {
    tables.escalation_risk_factors.push({
      escalation_id: escalationId,
      factor_order: index + 1,
      factor,
      detail
    });
  });
  ownerGroups.forEach((ownerGroup, index) => {
    const taskId = `task-${orderId}-${slug(ownerGroup)}`;
    tables.escalation_tasks.push({
      task_id: taskId,
      escalation_id: escalationId,
      account_id: order.account_id,
      order_id: orderId,
      owner_group: ownerGroup,
      title: taskTitle(ownerGroup),
      status: "open",
      due_at: "2026-06-17T16:00:00.000Z"
    });
    tables.escalation_task_assignments.push({
      task_id: taskId,
      owner_group: ownerGroup,
      assignee_name: assigneeName(tables, order.account_id, ownerGroup)
    });
    tables.executive_notifications.push({
      notification_id: `notify-${orderId}-${index + 1}`,
      escalation_id: escalationId,
      owner_group: ownerGroup,
      status: "queued",
      created_at: now
    });
  });
  tables.customer_portal_messages.push({
    message_id: `msg-${orderId}-escalation`,
    escalation_id: escalationId,
    account_id: order.account_id,
    order_id: orderId,
    title: policy.customer_visible_title,
    body: policy.customer_message,
    created_at: now
  });
  tables.legal_review_requests.push({
    request_id: `legal-${orderId}`,
    escalation_id: escalationId,
    status: "open",
    created_at: now
  });
  tables.finance_review_requests.push({
    request_id: `finance-${orderId}`,
    escalation_id: escalationId,
    status: "open",
    created_at: now
  });
  tables.order_status_history.push({
    history_id: `hist-${orderId}-customer-escalation-active`,
    order_id: orderId,
    status: "customer_escalation_active",
    customer_visible: true,
    occurred_at: now
  });
  tables.audit_events.push({
    audit_id: `audit-${orderId}-customer-360-escalation`,
    subject_type: "customer_escalation",
    subject_id: escalationId,
    actor: "proof-runner",
    action: "route_customer_360_escalation",
    occurred_at: now,
    customer_visible: true
  });
  tables.audit_subjects.push(
    { audit_id: `audit-${orderId}-customer-360-escalation`, subject_type: "order", subject_id: orderId },
    { audit_id: `audit-${orderId}-customer-360-escalation`, subject_type: "account", subject_id: order.account_id }
  );

  return buildPostgresPortalView(tables, orderId);
}

export function buildPostgresPortalView(tables, orderId) {
  const order = tables.orders.find((item) => item.order_id === orderId);
  if (!order) throw new Error(`Postgres order not found: ${orderId}`);

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

function taskTitle(ownerGroup) {
  return {
    "Customer Success": "Coordinate executive recovery plan",
    Legal: "Review regulated shipment and disclosure language",
    Finance: "Resolve payment hold and invoice risk",
    Support: "Publish customer-safe support timeline"
  }[ownerGroup] || `Follow up for ${ownerGroup}`;
}

function assigneeName(tables, accountId, ownerGroup) {
  return tables.account_team_members.find((item) => item.account_id === accountId && item.owner_group === ownerGroup)?.name || ownerGroup;
}

function slug(value) {
  return String(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
}
