import { buildPortalView } from "./portal-view.mjs";

export function applyOrderException(tables, orderId, now) {
  const order = required(tables.orders.find((item) => item.order_id === orderId), `Order not found: ${orderId}`);
  const account = required(
    tables.accounts.find((item) => item.account_id === order.account_id),
    `Account not found: ${order.account_id}`
  );
  const policy = tables.escalation_policies.find((item) =>
    item.applies_to_status === order.current_status &&
    order.value_cents >= item.min_value_cents &&
    account.tier_id === "strategic"
  );

  if (!policy) return buildPortalView(tables, orderId);

  const escalationId = `esc-${orderId.toLowerCase()}`;
  const shipment = tables.shipments.find((item) => item.order_id === orderId);
  const invoice = tables.invoices.find((item) => item.order_id === orderId);
  const payment = tables.payments.find((item) => item.order_id === orderId);
  const paymentRisk = invoice && tables.payment_risk_events.find((item) => item.invoice_id === invoice.invoice_id);
  const contract = tables.account_contracts.find((item) => item.account_id === account.account_id);
  const usage = latestBy(tables.usage_snapshots.filter((item) => item.account_id === account.account_id), "captured_at");
  const supportCases = tables.support_cases.filter((item) =>
    item.account_id === account.account_id &&
    item.status !== "closed" &&
    (item.order_id === orderId || item.order_id === null)
  );
  const complianceReview = tables.compliance_reviews.find((item) =>
    item.account_id === account.account_id &&
    item.order_id === orderId &&
    item.status !== "cleared"
  );
  const complianceFlags = complianceReview
    ? tables.compliance_review_flags
      .filter((item) => item.review_id === complianceReview.review_id)
      .map((item) => item.flag)
    : [];
  const shipmentFlags = shipment
    ? tables.shipment_regulatory_flags
      .filter((item) => item.shipment_id === shipment.shipment_id)
      .map((item) => item.flag)
    : [];

  const escalation = upsert(tables.customer_escalations, "escalation_id", {
    escalation_id: escalationId,
    policy_id: policy.policy_id,
    account_id: account.account_id,
    order_id: order.order_id,
    status: "active",
    customer_visible_title: policy.customer_visible_title,
    customer_visible_status: policy.customer_visible_status,
    next_step: policy.next_step,
    customer_message: policy.customer_message,
    created_at: now,
    updated_at: now
  });

  const riskFactors = [
    [
      "shipment delay",
      shipment
        ? `${shipment.carrier} reported ${shipment.delay_reason}; release target ${shipment.promised_release_time}.`
        : "Order status is delayed and shipment details are unavailable."
    ],
    [
      "strategic account",
      `${account.name} is a ${account.tier_id} account on ${contract?.contract_tier ?? "unknown"} contract tier.`
    ],
    [
      "open support case",
      supportCases.map((item) => `${item.case_id} ${item.priority}: ${item.summary}`).join(" | ")
    ],
    [
      "invoice risk",
      invoice
        ? `${invoice.invoice_id} is ${invoice.status}; risk ${invoice.risk ?? paymentRisk?.risk_code ?? "none"}; payment ${payment?.status ?? "unknown"}.`
        : "No invoice found for the delayed order."
    ],
    [
      "usage drop",
      usage
        ? `${usage.active_users_7d} active users over 7d vs ${usage.active_users_previous_7d} prior; trend ${usage.trend}; ${usage.failed_syncs_24h} failed syncs in 24h.`
        : "No recent usage snapshot found."
    ],
    [
      "regulatory review",
      complianceReview
        ? `${complianceReview.review_id} is ${complianceReview.status}; flags ${[...new Set([...shipmentFlags, ...complianceFlags])].join(", ")}.`
        : "No active regulatory review found."
    ]
  ];

  riskFactors.forEach(([factor, detail], index) => {
    upsert(tables.escalation_risk_factors, "risk_factor_id", {
      risk_factor_id: `${escalationId}-risk-${index + 1}`,
      escalation_id: escalation.escalation_id,
      factor_order: index + 1,
      factor,
      detail,
      created_at: now
    });
  });

  const dueAt = shipment?.promised_release_time ?? now;
  const taskTitles = {
    "Customer Success": "Own executive recovery plan",
    Legal: "Review customer-safe escalation language",
    Finance: "Resolve invoice and payment risk",
    Support: "Coordinate support case updates"
  };

  tables.escalation_policy_steps
    .filter((item) => item.policy_id === policy.policy_id)
    .sort((a, b) => a.step_order - b.step_order)
    .forEach((step) => {
      const task = upsert(tables.escalation_tasks, "task_id", {
        task_id: `${escalationId}-task-${slug(step.owner_group)}`,
        escalation_id: escalation.escalation_id,
        account_id: account.account_id,
        order_id: order.order_id,
        owner_group: step.owner_group,
        title: taskTitles[step.owner_group] ?? `Review ${step.owner_group} escalation action`,
        status: "open",
        due_at: dueAt,
        created_at: now
      });
      const owner = tables.account_team_members.find((item) =>
        item.account_id === account.account_id &&
        item.owner_group === step.owner_group
      );
      if (owner) {
        upsert(tables.escalation_task_assignments, "assignment_id", {
          assignment_id: `${task.task_id}-assignment`,
          task_id: task.task_id,
          member_id: owner.member_id,
          assigned_at: now
        });
      }
    });

  upsert(tables.customer_portal_messages, "message_id", {
    message_id: `${escalationId}-portal-message`,
    escalation_id: escalation.escalation_id,
    account_id: account.account_id,
    order_id: order.order_id,
    body: policy.customer_message,
    visibility: "customer",
    published_at: now
  });

  upsert(tables.legal_review_requests, "request_id", {
    request_id: `${escalationId}-legal-review`,
    escalation_id: escalation.escalation_id,
    account_id: account.account_id,
    order_id: order.order_id,
    status: "open",
    reason: "Customer-safe recovery language and regulatory review required.",
    due_at: dueAt,
    created_at: now
  });

  upsert(tables.finance_review_requests, "request_id", {
    request_id: `${escalationId}-finance-review`,
    escalation_id: escalation.escalation_id,
    account_id: account.account_id,
    order_id: order.order_id,
    status: "open",
    reason: "Past-due invoice and payment hold risk require recovery alignment.",
    due_at: dueAt,
    created_at: now
  });

  const auditId = `${escalationId}-audit-activated`;
  upsert(tables.audit_events, "audit_id", {
    audit_id: auditId,
    subject_type: "customer_escalation",
    subject_id: escalation.escalation_id,
    event_type: "customer_360_escalation_activated",
    summary: "Executive escalation activated with six risk factors, four owner tasks, and customer-safe portal status.",
    customer_visible: true,
    occurred_at: now
  });

  [
    ["customer_escalation", escalation.escalation_id],
    ["order", order.order_id],
    ["account", account.account_id],
    shipment && ["shipment", shipment.shipment_id],
    invoice && ["invoice", invoice.invoice_id],
    complianceReview && ["compliance_review", complianceReview.review_id],
    ...supportCases.map((item) => ["support_case", item.case_id])
  ].filter(Boolean).forEach(([subjectType, subjectId]) => {
    upsert(tables.audit_subjects, "audit_subject_id", {
      audit_subject_id: `${auditId}-${subjectType}-${subjectId}`,
      audit_id: auditId,
      subject_type: subjectType,
      subject_id: subjectId
    });
  });

  return buildPortalView(tables, orderId);
}

function required(value, message) {
  if (!value) throw new Error(message);
  return value;
}

function latestBy(items, field) {
  return [...items].sort((a, b) => String(b[field]).localeCompare(String(a[field])))[0];
}

function upsert(rows, key, row) {
  const existing = rows.find((item) => item[key] === row[key]);
  if (existing) {
    Object.assign(existing, row);
    return existing;
  }
  rows.push(row);
  return row;
}

function slug(value) {
  return value.toLowerCase().replaceAll(" ", "-");
}
