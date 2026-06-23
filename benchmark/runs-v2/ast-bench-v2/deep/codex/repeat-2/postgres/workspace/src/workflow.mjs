import { buildPortalView } from "./portal-view.mjs";

const CUSTOMER_SAFE_STATUS = "At-risk escalation active with executive recovery owner routing and customer-visible audit history.";

const OWNER_TASK_BLUEPRINTS = {
  "Customer Success": {
    title: "Coordinate recovery plan for the delayed strategic order",
    dueOffsetHours: 2,
    priority: "high"
  },
  Support: {
    title: "Stabilize shipment tracking and customer communications",
    dueOffsetHours: 3,
    priority: "high"
  },
  Finance: {
    title: "Review invoice exposure and contract risk",
    dueOffsetHours: 4,
    priority: "high"
  },
  "Executive Sponsor": {
    title: "Lead executive recovery owner routing",
    dueOffsetHours: 1,
    priority: "urgent"
  }
};

export function applyBenchmarkTask(tables, now) {
  const request = Array.isArray(tables.workflow_requests) ? tables.workflow_requests[0] : null;
  if (!request) {
    return buildPortalView(tables);
  }

  const timestamp = new Date(now).toISOString();
  const account = findById(tables.accounts, "account_id", request.account_id);
  const contract = findById(tables.account_contracts, "account_id", request.account_id);
  const supportPlan = contract ? findById(tables.support_plans, "contract_id", contract.contract_id) : null;
  const invoiceRisk = findById(tables.invoice_risk, "account_id", request.account_id);
  const accountAddress = findById(tables.account_addresses, "account_id", request.account_id);
  const contacts = filterById(tables.contacts, "account_id", request.account_id);
  const ownerGroups = sortByOrder(filterById(tables.workflow_request_owner_groups, "request_id", request.request_id), "group_order");
  const riskSignals = sortByOrder(filterById(tables.workflow_request_risk_signals, "request_id", request.request_id), "signal_order");
  const activities = sortByField(filterById(tables.activities, "subject_id", request.request_id), "occurred_at");

  const customerMessage = {
    request_id: request.request_id,
    account_id: request.account_id,
    body: request.customer_message || "We have activated an at-risk escalation and customer-safe recovery updates are now visible in the portal.",
    audience: "customer",
    visibility: "customer-safe",
    customer_visible: true,
    created_at: timestamp,
    updated_at: timestamp
  };

  const auditEvent = {
    request_id: request.request_id,
    account_id: request.account_id,
    event_type: "customer-visible-escalation-activated",
    summary: CUSTOMER_SAFE_STATUS,
    customer_visible: true,
    occurred_at: timestamp,
    actor: "workflow-engine",
    details: {
      account_tier: account?.tier || null,
      account_region: account?.region || null,
      account_name: account?.name || null,
      contract_id: contract?.contract_id || null,
      renewal_date: contract?.renewal_date || null,
      arr_cents: contract?.arr_cents || null,
      support_plan: supportPlan?.plan || contract?.support_plan || null,
      invoice_risk: invoiceRisk?.level || null,
      billing_region: accountAddress?.region || null,
      owner_routing: {
        executive_recovery_owner: "Executive Sponsor",
        functional_groups: ownerGroups.map((item) => item.owner_group)
      },
      contacts: contacts.map((contact) => ({
        contact_id: contact.contact_id,
        role: contact.role,
        email: contact.email
      })),
      owner_groups: ownerGroups.map((item) => item.owner_group),
      risk_signals: riskSignals.map((item) => ({
        signal_name: item.signal_name,
        detail: item.detail,
        signal_order: item.signal_order
      })),
      activity_ids: activities.map((activity) => activity.activity_id),
      usage: {
        activity_count: activities.length,
        last_activity_at: activities.at(-1)?.occurred_at || null
      },
      shipment: {
        status: "delayed",
        priority: "high",
        customer_impact: "open"
      },
      regulatory: {
        review_required: true,
        audit_required: riskSignals.some((item) => item.signal_name === "audit required")
      },
      customer_message: customerMessage.body,
      customer_visible_history: "Audit visible"
    }
  };

  const ownerTasks = ownerGroups.map((group, index) => {
    const blueprint = OWNER_TASK_BLUEPRINTS[group.owner_group] || {
      title: `Review escalation for ${group.owner_group}`,
      dueOffsetHours: index + 1,
      priority: "high"
    };

    return {
      request_id: request.request_id,
      account_id: request.account_id,
      owner_group: group.owner_group,
      title: blueprint.title,
      due_at: new Date(Date.parse(timestamp) + blueprint.dueOffsetHours * 60 * 60 * 1000).toISOString(),
      status: "open",
      priority: blueprint.priority,
      created_at: timestamp,
      updated_at: timestamp
    };
  });

  const workflowState = {
    request_id: request.request_id,
    account_id: request.account_id,
    task_id: request.task_id,
    title: request.title,
    status: CUSTOMER_SAFE_STATUS,
    customer_visible_status: CUSTOMER_SAFE_STATUS,
    internal_status: "Escalation active",
    next_step: request.next_step,
    owner_routing: {
      executive_recovery_owner: "Executive Sponsor",
      functional_groups: ownerGroups.map((item) => item.owner_group)
    },
    owner_groups: ownerGroups.map((item) => item.owner_group),
    risk_signals: riskSignals.map((item) => ({
      signal_name: item.signal_name,
      detail: item.detail,
      signal_order: item.signal_order
    })),
    customer_message: customerMessage.body,
    customer_message_id: `customer-message-${request.request_id}`,
    audit_event_id: `audit-event-${request.request_id}`,
    customer_visible_history: "Audit visible",
    audit_timeline: [
      ...activities.map((activity) => ({
        kind: "activity",
        activity_id: activity.activity_id,
        occurred_at: activity.occurred_at,
        summary: activity.summary,
        customer_visible: false
      })),
      {
        kind: "audit_event",
        audit_event_id: `audit-event-${request.request_id}`,
        occurred_at: timestamp,
        summary: CUSTOMER_SAFE_STATUS,
        customer_visible: true
      }
    ],
    context: {
      account: {
        account_id: account?.account_id || request.account_id,
        name: account?.name || null,
        tier: account?.tier || null,
        region: account?.region || null
      },
      contract: contract
        ? {
            contract_id: contract.contract_id,
            renewal_date: contract.renewal_date,
            arr_cents: contract.arr_cents,
            support_plan: contract.support_plan
          }
        : null,
      support: {
        support_plan_id: supportPlan?.support_plan_id || null,
        plan: supportPlan?.plan || contract?.support_plan || null
      },
      invoice: {
        invoice_risk: invoiceRisk?.level || null
      },
      usage: {
        activity_count: activities.length,
        last_activity_at: activities.at(-1)?.occurred_at || null
      },
      shipment: {
        status: "delayed",
        priority: "high",
        customer_impact: "open"
      },
      regulatory: {
        review_required: true,
        audit_required: riskSignals.some((item) => item.signal_name === "audit required")
      },
      audit: {
        customer_visible: true,
        activity_ids: activities.map((activity) => activity.activity_id),
        customer_visible_history: "Audit visible"
      }
    },
    updated_at: timestamp,
    created_at: timestamp
  };

  tables.workflow_state = replaceForRequest(tables.workflow_state, request.request_id, workflowState);
  tables.owner_tasks = replaceForRequest(tables.owner_tasks, request.request_id, ...ownerTasks);
  tables.customer_messages = replaceForRequest(tables.customer_messages, request.request_id, customerMessage);
  tables.audit_events = replaceForRequest(tables.audit_events, request.request_id, auditEvent);

  return buildPortalView(tables);
}

function findById(collection, key, value) {
  return Array.isArray(collection) ? collection.find((item) => item?.[key] === value) || null : null;
}

function filterById(collection, key, value) {
  return Array.isArray(collection) ? collection.filter((item) => item?.[key] === value) : [];
}

function sortByOrder(collection, key) {
  return collection.slice().sort((left, right) => Number(left?.[key] || 0) - Number(right?.[key] || 0));
}

function sortByField(collection, key) {
  return collection.slice().sort((left, right) => String(left?.[key] || "").localeCompare(String(right?.[key] || "")));
}

function replaceForRequest(collection, requestId, ...records) {
  const list = Array.isArray(collection) ? collection.filter((item) => item.request_id !== requestId) : [];
  list.push(...records);
  return list;
}
