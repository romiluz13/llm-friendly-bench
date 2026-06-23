import { buildPortalView } from "./portal-view.mjs";

const GENERATED_BY = "benchmark";
const HOUR_MS = 60 * 60 * 1000;

export function applyBenchmarkTask(db, now) {
  const request = db.workflow_requests[0];
  const account = db.accounts.find((item) => item.account_id === request.account_id);
  const contract = db.account_contracts.find((item) => item.account_id === request.account_id);
  const supportPlan = contract
    ? db.support_plans.find((item) => item.contract_id === contract.contract_id)
    : undefined;
  const invoiceRisk = db.invoice_risk.find((item) => item.account_id === request.account_id);
  const billingAddress = db.account_addresses.find(
    (item) => item.account_id === request.account_id && item.kind === "billing"
  );
  const ownerGroups = sortRows(
    db.workflow_request_owner_groups.filter((item) => item.request_id === request.request_id),
    "group_order"
  );
  const riskSignals = sortRows(
    db.workflow_request_risk_signals.filter((item) => item.request_id === request.request_id),
    "signal_order"
  );
  const activities = sortRows(
    db.activities.filter((item) => item.subject_id === request.request_id),
    "occurred_at"
  ).map((activity) => ({
    ...activity,
    source: db.activity_sources.find((item) => item.activity_id === activity.activity_id)?.source || "system"
  }));

  const customerMessage = buildCustomerMessage({
    account,
    contract,
    supportPlan,
    ownerGroups
  });
  const auditDetail = buildAuditDetail({
    account,
    contract,
    supportPlan,
    invoiceRisk,
    billingAddress,
    ownerGroups,
    riskSignals,
    activities
  });

  upsertSingleRow(db.workflow_state, request.request_id, {
    request_id: request.request_id,
    account_id: request.account_id,
    title: request.title,
    status: request.expected_outcome,
    next_step: request.next_step,
    customer_message: customerMessage,
    account_tier: account?.tier,
    contract_id: contract?.contract_id,
    support_plan: supportPlan?.plan || contract?.support_plan,
    invoice_risk_level: invoiceRisk?.level,
    billing_region: billingAddress?.region,
    risk_signal_summary: riskSignals.map((item) => item.signal_name).join(", "),
    activity_count: activities.length,
    updated_at: now,
    generated_by: GENERATED_BY
  });

  upsertManyRows(db.owner_tasks, request.request_id, ownerGroups.map((group, index) => {
    const ownerGroup = group.owner_group;
    const routingContact = pickRoutingContact(ownerGroup);
    return {
      request_id: request.request_id,
      account_id: request.account_id,
      owner_group: ownerGroup,
      title: `${ownerGroup} recovery action for ${request.title}`,
      due_at: buildDueAt(now, index + 1),
      status: "open",
      contact_id: routingContact?.contact_id,
      contact_email: routingContact?.email,
      group_order: group.group_order,
      generated_by: GENERATED_BY
    };
  }));

  upsertSingleRow(db.customer_messages, request.request_id, {
    request_id: request.request_id,
    account_id: request.account_id,
    body: customerMessage,
    sent_at: now,
    generated_by: GENERATED_BY
  });

  upsertSingleRow(db.audit_events, request.request_id, {
    request_id: request.request_id,
    account_id: request.account_id,
    event: "escalation_activated",
    detail: auditDetail,
    customer_visible: true,
    created_at: now,
    activity_count: activities.length,
    generated_by: GENERATED_BY
  });

  return buildPortalView(db);

  function buildCustomerMessage({
    account: accountRow,
    contract: contractRow,
    supportPlan: supportPlanRow,
    ownerGroups: ownerGroupRows
  }) {
    const ownerList = ownerGroupRows.map((item) => item.owner_group).join(", ");
    const accountName = accountRow?.name || request.title;
    const tier = accountRow?.tier || "strategic";
    const support = supportPlanRow?.plan || contractRow?.support_plan || "support";
    return `We have activated an at-risk escalation for ${accountName}. ${capitalize(tier)} coverage is coordinating recovery across ${ownerList} under ${support} support while the portal keeps the customer-visible audit trail available.`;
  }

  function buildAuditDetail({
    account: accountRow,
    contract: contractRow,
    supportPlan: supportPlanRow,
    invoiceRisk: invoiceRiskRow,
    billingAddress: billingAddressRow,
    ownerGroups: ownerGroupRows,
    riskSignals: riskSignalRows,
    activities: activityRows
  }) {
    const ownerList = ownerGroupRows.map((item) => item.owner_group).join(", ");
    const signalList = riskSignalRows.map((item) => item.signal_name).join(", ");
    const activityList = activityRows
      .map((item) => `${item.occurred_at} ${item.summary} (${item.source})`)
      .join(" | ");

    return [
      `Escalation activated for ${accountRow?.name || request.title}`,
      `tier=${accountRow?.tier || "unknown"}`,
      `contract=${contractRow?.contract_id || "unknown"} renews ${contractRow?.renewal_date || "unknown"}`,
      `support=${supportPlanRow?.plan || contractRow?.support_plan || "unknown"}`,
      `invoice_risk=${invoiceRiskRow?.level || "unknown"}`,
      `billing_region=${billingAddressRow?.region || "unknown"}`,
      `owners=${ownerList}`,
      `signals=${signalList}`,
      `activities=${activityList}`
    ].join("; ");
  }

  function pickRoutingContact(ownerGroup) {
    const mappings = db.contact_x_owner_group.filter(
      (item) => item.request_id === request.request_id && item.owner_group === ownerGroup
    );
    const mappedContacts = mappings
      .map((mapping) => db.contacts.find((contact) => contact.contact_id === mapping.contact_id && contact.account_id === request.account_id))
      .filter(Boolean);
    if (ownerGroup === "Finance") {
      return mappedContacts.find((contact) => contact.role === "Finance") || mappedContacts[0];
    }
    return mappedContacts.find((contact) => contact.role === "Operations") || mappedContacts[0];
  }
}

function upsertSingleRow(table, requestId, row) {
  const keep = table.filter((item) => item.request_id !== requestId || item.generated_by !== GENERATED_BY);
  keep.push(row);
  table.splice(0, table.length, ...keep);
}

function upsertManyRows(table, requestId, rows) {
  const keep = table.filter((item) => item.request_id !== requestId || item.generated_by !== GENERATED_BY);
  keep.push(...rows);
  table.splice(0, table.length, ...keep);
}

function sortRows(rows, key) {
  return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key]), "en", { numeric: true }));
}

function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function buildDueAt(now, offsetHours) {
  return new Date(new Date(now).getTime() + offsetHours * HOUR_MS).toISOString();
}
