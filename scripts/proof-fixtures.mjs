import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const scenarioDefinitionPath = "scenarios/customer-order-lifecycle/scenario-definition.json";
export const generatedFixturePath = "data/generated/scenario-fixture-v2.json";
export const mongoProjectionPath = "data/generated/mongodb/collections.json";
export const postgresProjectionPath = "data/generated/postgres/tables.json";

export function readScenarioDefinition() {
  return JSON.parse(readFileSync(scenarioDefinitionPath, "utf8"));
}

export function generateFixtureArtifacts() {
  const scenario = readScenarioDefinition();
  const fixture = buildCanonicalFixture(scenario);
  const mongo = projectMongoCollections(fixture);
  const postgres = projectPostgresTables(fixture);

  writeJson(generatedFixturePath, fixture);
  writeJson(mongoProjectionPath, mongo);
  writeJson(postgresProjectionPath, postgres);

  return { fixture, mongo, postgres };
}

function buildCanonicalFixture(scenario) {
  const productsById = new Map(scenario.products.map((product) => [product.productId, product]));
  const accountsById = new Map(scenario.accounts.map((account) => [account.accountId, account]));

  return {
    scenarioVersion: scenario.scenarioVersion,
    scenarioName: scenario.scenarioName,
    variant: scenario.variant,
    generatedAt: scenario.generatedAt,
    task: scenario.task,
    accounts: scenario.accounts.map((account) => ({
      ...account,
      billingSummary: billingSummary(scenario.invoices, account.accountId),
      usageSummary: latestBy(scenario.usageSnapshots.filter((item) => item.accountId === account.accountId), "capturedAt"),
      supportSummary: supportSummary(scenario.supportCases, account.accountId),
      complianceSummary: complianceSummary(scenario.complianceReviews, account.accountId)
    })),
    products: scenario.products,
    orders: scenario.orders.map((order) => {
      const lineItems = order.lineItems.map((item) => {
        const product = productsById.get(item.productId);
        if (!product) throw new Error(`Unknown product ${item.productId}`);
        return {
          ...item,
          productName: product.name,
          category: product.category,
          unitPriceCents: product.unitPriceCents,
          lineTotalCents: item.quantity * product.unitPriceCents
        };
      });
      const account = accountsById.get(order.accountId);

      return {
        ...order,
        lineItems,
        fulfillment: {
          shipmentId: `ship-${order.orderId}`,
          carrier: order.regulatedShipment ? "Northstar Compliance Freight" : "MetroShip",
          delayed: order.status === "delayed",
          regulatoryFlags: order.regulatedShipment ? ["regulated-shipping"] : [],
          delayReason: order.delayReason,
          promisedReleaseTime: order.promisedReleaseTime
        },
        payment: {
          paymentId: `pay-${order.orderId}`,
          status: "captured",
          amountCents: order.valueCents
        },
        riskContext: {
          accountTier: account?.tier,
          contractTier: account?.contract?.tier,
          arrCents: account?.contract?.arrCents,
          renewalDate: account?.contract?.renewalDate
        },
        statusHistory: [
          {
            status: order.status,
            customerVisible: order.status !== "delivered",
            occurredAt: order.createdAt,
            summary: order.status === "delayed" ? "Shipment delayed" : "Order status updated"
          }
        ]
      };
    }),
    supportCases: scenario.supportCases,
    invoices: scenario.invoices,
    usageSnapshots: scenario.usageSnapshots,
    complianceReviews: scenario.complianceReviews,
    escalationPolicy: {
      policyId: "policy-strategic-customer-360-escalation",
      name: "Strategic customer 360 escalation",
      appliesToStatus: "delayed",
      minValueCents: 500000,
      requiredAccountTiers: ["strategic", "enterprise"],
      requiredSignals: ["shipment", "account-tier", "support", "invoice", "usage", "regulatory"],
      ownerGroups: ["Customer Success", "Legal", "Finance", "Support"],
      customerVisibleTitle: "At-risk escalation active",
      customerVisibleStatus: "Executive escalation",
      nextStep: "Executive recovery plan by 16:00",
      customerMessage: "We are coordinating executive recovery for your delayed shipment."
    },
    slaPolicies: [
      { policyId: "sla-strategic-na", tier: "strategic", region: "NA", responseMinutes: 60 },
      { policyId: "sla-enterprise-na", tier: "enterprise", region: "NA", responseMinutes: 240 },
      { policyId: "sla-enterprise-eu", tier: "enterprise", region: "EU", responseMinutes: 360 },
      { policyId: "sla-growth-na", tier: "growth", region: "NA", responseMinutes: 720 },
      { policyId: "sla-commercial-apac", tier: "commercial", region: "APAC", responseMinutes: 1440 }
    ]
  };
}

function projectMongoCollections(fixture) {
  return {
    accounts: fixture.accounts.map((account) => ({
      _id: account.accountId,
      name: account.name,
      tier: account.tier,
      segment: account.segment,
      region: account.region,
      riskFlags: account.riskFlags,
      contacts: account.contacts,
      contract: account.contract,
      health: account.health,
      accountTeam: account.accountTeam,
      billingSummary: account.billingSummary,
      usageSummary: account.usageSummary,
      supportSummary: account.supportSummary,
      complianceSummary: account.complianceSummary,
      slaSummary: fixture.slaPolicies.find((policy) => policy.tier === account.tier && policy.region === account.region),
      currentEscalation: null,
      taskSummary: []
    })),
    orders: fixture.orders.map((order) => ({
      _id: order.orderId,
      accountId: order.accountId,
      contactId: order.contactId,
      createdAt: order.createdAt,
      status: order.status,
      valueCents: order.valueCents,
      currency: order.currency,
      regulatedShipment: order.regulatedShipment,
      delayReason: order.delayReason,
      promisedReleaseTime: order.promisedReleaseTime,
      lineItems: order.lineItems,
      fulfillment: order.fulfillment,
      payment: order.payment,
      riskContext: order.riskContext,
      exception: null,
      statusHistory: order.statusHistory
    })),
    products: fixture.products.map((product) => ({
      _id: product.productId,
      name: product.name,
      category: product.category,
      price: { amountCents: product.unitPriceCents, currency: "USD" },
      complianceTags: product.category === "regulated" ? ["regulated-shipping"] : []
    })),
    support_cases: fixture.supportCases.map((supportCase) => ({
      _id: supportCase.caseId,
      caseId: supportCase.caseId,
      accountId: supportCase.accountId,
      orderId: supportCase.orderId,
      openedAt: supportCase.openedAt,
      priority: supportCase.priority,
      status: supportCase.status,
      customerNeed: supportCase.summary,
      latestComment: supportCase.summary
    })),
    invoice_snapshots: fixture.invoices.map((invoice) => ({
      _id: invoice.invoiceId,
      ...invoice
    })),
    usage_snapshots: fixture.usageSnapshots.map((snapshot) => ({
      _id: snapshot.snapshotId,
      ...snapshot
    })),
    compliance_reviews: fixture.complianceReviews.map((review) => ({
      _id: review.reviewId,
      ...review
    })),
    customer_escalations: [],
    work_items: [],
    audit_events: [],
    escalation_policies: [fixture.escalationPolicy],
    sla_policies: fixture.slaPolicies,
    activities: fixture.supportCases.map((supportCase) => ({
      _id: `act-${supportCase.caseId}`,
      accountId: supportCase.accountId,
      caseId: supportCase.caseId,
      orderId: supportCase.orderId,
      summary: supportCase.summary,
      occurredAt: supportCase.openedAt,
      participants: []
    })),
    inventory_snapshots: fixture.orders.flatMap((order) =>
      order.lineItems.map((item) => ({
        _id: `inv-${order.orderId}-${item.productId}`,
        productId: item.productId,
        reservationSummary: {
          orderId: order.orderId,
          quantity: item.quantity,
          region: fixture.accounts.find((account) => account.accountId === order.accountId)?.region
        }
      }))
    )
  };
}

function projectPostgresTables(fixture) {
  const tableNames = [
    "account_tiers",
    "owner_groups",
    "accounts",
    "contacts",
    "contact_preferences",
    "account_contracts",
    "account_team_members",
    "account_risk_flags",
    "account_health_scores",
    "account_health_factors",
    "account_notes",
    "products",
    "product_categories",
    "product_category_memberships",
    "subscriptions",
    "entitlements",
    "orders",
    "order_items",
    "shipments",
    "shipment_events",
    "shipment_regulatory_flags",
    "payments",
    "payment_events",
    "invoices",
    "invoice_line_items",
    "payment_risk_events",
    "usage_snapshots",
    "usage_products",
    "support_cases",
    "case_comments",
    "support_case_links",
    "activities",
    "activity_participants",
    "compliance_reviews",
    "compliance_review_flags",
    "escalation_policies",
    "escalation_policy_steps",
    "customer_escalations",
    "escalation_risk_factors",
    "escalation_tasks",
    "escalation_task_assignments",
    "customer_portal_messages",
    "executive_notifications",
    "legal_review_requests",
    "finance_review_requests",
    "success_plan_milestones",
    "renewal_events",
    "order_status_history",
    "audit_events",
    "audit_subjects",
    "sla_policies",
    "sla_timers",
    "inventory_locations",
    "inventory_reservations",
    "portal_visibility_rules",
    "notification_outbox"
  ];
  const tables = Object.fromEntries(tableNames.map((name) => [name, []]));
  const tiers = new Set();
  const categories = new Set();
  const ownerGroups = new Set(["Customer Success", "Legal", "Finance", "Support", "Operations", "Sales"]);

  for (const account of fixture.accounts) {
    tiers.add(account.tier);
    tables.accounts.push({
      account_id: account.accountId,
      tier_id: account.tier,
      name: account.name,
      segment: account.segment,
      region: account.region
    });
    tables.account_contracts.push({
      contract_id: account.contract.contractId,
      account_id: account.accountId,
      contract_tier: account.contract.tier,
      arr_cents: account.contract.arrCents,
      renewal_date: account.contract.renewalDate,
      executive_sponsor: account.contract.executiveSponsor,
      support_plan: account.contract.supportPlan,
      data_processing_addendum: account.contract.dataProcessingAddendum
    });
    tables.account_health_scores.push({
      account_id: account.accountId,
      score: account.health.score,
      trend: account.health.trend,
      summary: account.health.summary,
      captured_at: fixture.generatedAt
    });
    tables.account_health_factors.push(
      { account_id: account.accountId, factor: "contract_tier", value: account.contract.tier },
      { account_id: account.accountId, factor: "arr_cents", value: String(account.contract.arrCents) },
      { account_id: account.accountId, factor: "usage_trend", value: account.health.trend }
    );
    for (const member of account.accountTeam) {
      ownerGroups.add(member.ownerGroup);
      tables.account_team_members.push({
        member_id: `team-${account.accountId}-${slug(member.ownerGroup)}`,
        account_id: account.accountId,
        owner_group: member.ownerGroup,
        name: member.name,
        role: member.role
      });
    }
    for (const contact of account.contacts) {
      tables.contacts.push({
        contact_id: contact.contactId,
        account_id: account.accountId,
        name: contact.name,
        role: contact.role,
        email: contact.email
      });
      tables.contact_preferences.push({ contact_id: contact.contactId, channel: "email", enabled: true });
    }
    for (const riskFlag of account.riskFlags) {
      tables.account_risk_flags.push({ account_id: account.accountId, risk_flag: riskFlag });
    }
    tables.subscriptions.push({
      subscription_id: `sub-${account.accountId}`,
      account_id: account.accountId,
      contract_id: account.contract.contractId,
      product_family: "customer-operations-platform",
      status: "active"
    });
    tables.entitlements.push({
      entitlement_id: `ent-${account.accountId}-support`,
      subscription_id: `sub-${account.accountId}`,
      feature: account.contract.supportPlan,
      enabled: true
    });
    tables.success_plan_milestones.push({
      milestone_id: `sp-${account.accountId}-renewal`,
      account_id: account.accountId,
      due_at: account.contract.renewalDate,
      owner_group: "Customer Success",
      status: account.accountId === fixture.task.accountId ? "at_risk" : "open"
    });
    tables.renewal_events.push({
      renewal_event_id: `renewal-${account.accountId}`,
      account_id: account.accountId,
      renewal_date: account.contract.renewalDate,
      status: account.riskFlags.includes("renewal-at-risk") ? "at_risk" : "on_track"
    });
  }

  for (const tier of tiers) {
    tables.account_tiers.push({ tier_id: tier, label: tier, review_minutes: tier === "strategic" ? 60 : tier === "enterprise" ? 30 : 15 });
  }
  for (const group of ownerGroups) {
    tables.owner_groups.push({ owner_group: group, label: group });
  }

  for (const product of fixture.products) {
    categories.add(product.category);
    tables.products.push({
      product_id: product.productId,
      name: product.name,
      unit_price_cents: product.unitPriceCents
    });
    tables.product_category_memberships.push({ product_id: product.productId, category_id: product.category });
  }
  for (const category of categories) {
    tables.product_categories.push({ category_id: category, label: category });
  }

  for (const order of fixture.orders) {
    tables.orders.push({
      order_id: order.orderId,
      account_id: order.accountId,
      contact_id: order.contactId,
      created_at: order.createdAt,
      current_status: order.status,
      value_cents: order.valueCents,
      currency: order.currency
    });
    for (const item of order.lineItems) {
      tables.order_items.push({ order_id: order.orderId, product_id: item.productId, quantity: item.quantity });
      tables.inventory_reservations.push({
        reservation_id: `res-${order.orderId}-${item.productId}`,
        order_id: order.orderId,
        product_id: item.productId,
        location_id: `loc-${order.accountId}`,
        quantity: item.quantity
      });
    }
    tables.shipments.push({
      shipment_id: order.fulfillment.shipmentId,
      order_id: order.orderId,
      carrier: order.fulfillment.carrier,
      delayed: order.fulfillment.delayed,
      delay_reason: order.fulfillment.delayReason,
      promised_release_time: order.fulfillment.promisedReleaseTime
    });
    tables.shipment_events.push({
      event_id: `ship-event-${order.orderId}-current`,
      shipment_id: order.fulfillment.shipmentId,
      event_type: order.fulfillment.delayed ? "delayed" : "in_transit",
      occurred_at: order.createdAt
    });
    for (const flag of order.fulfillment.regulatoryFlags) {
      tables.shipment_regulatory_flags.push({ shipment_id: order.fulfillment.shipmentId, flag });
    }
    tables.payments.push({
      payment_id: order.payment.paymentId,
      order_id: order.orderId,
      status: order.payment.status,
      amount_cents: order.payment.amountCents
    });
    tables.payment_events.push({
      event_id: `pay-event-${order.orderId}`,
      payment_id: order.payment.paymentId,
      event_type: order.payment.status,
      occurred_at: order.createdAt
    });
    for (const history of order.statusHistory) {
      tables.order_status_history.push({
        history_id: `hist-${order.orderId}-${history.status}`,
        order_id: order.orderId,
        status: history.status,
        customer_visible: history.customerVisible,
        occurred_at: history.occurredAt
      });
    }
  }

  for (const invoice of fixture.invoices) {
    tables.invoices.push({
      invoice_id: invoice.invoiceId,
      account_id: invoice.accountId,
      order_id: invoice.orderId,
      issued_at: invoice.issuedAt,
      due_at: invoice.dueAt,
      amount_cents: invoice.amountCents,
      status: invoice.status,
      risk: invoice.risk
    });
    tables.invoice_line_items.push({
      invoice_line_id: `line-${invoice.invoiceId}`,
      invoice_id: invoice.invoiceId,
      description: invoice.orderId ? `Order ${invoice.orderId}` : "Subscription charge",
      amount_cents: invoice.amountCents
    });
    if (invoice.risk) {
      tables.payment_risk_events.push({
        risk_event_id: `risk-${invoice.invoiceId}`,
        invoice_id: invoice.invoiceId,
        account_id: invoice.accountId,
        risk_code: invoice.risk,
        created_at: invoice.dueAt
      });
    }
  }

  for (const snapshot of fixture.usageSnapshots) {
    tables.usage_snapshots.push({
      snapshot_id: snapshot.snapshotId,
      account_id: snapshot.accountId,
      captured_at: snapshot.capturedAt,
      active_users_7d: snapshot.activeUsers7d,
      active_users_previous_7d: snapshot.activeUsersPrevious7d,
      critical_workflows: snapshot.criticalWorkflows,
      failed_syncs_24h: snapshot.failedSyncs24h,
      trend: snapshot.trend
    });
    tables.usage_products.push(
      { snapshot_id: snapshot.snapshotId, product_family: "operations", active_users: snapshot.activeUsers7d },
      { snapshot_id: snapshot.snapshotId, product_family: "integration-sync", active_users: Math.max(0, snapshot.activeUsers7d - snapshot.failedSyncs24h) }
    );
  }

  for (const supportCase of fixture.supportCases) {
    tables.support_cases.push({
      case_id: supportCase.caseId,
      account_id: supportCase.accountId,
      order_id: supportCase.orderId,
      opened_at: supportCase.openedAt,
      priority: supportCase.priority,
      status: supportCase.status,
      summary: supportCase.summary
    });
    tables.case_comments.push({
      comment_id: `comment-${supportCase.caseId}`,
      case_id: supportCase.caseId,
      created_at: supportCase.openedAt,
      body: supportCase.summary
    });
    if (supportCase.orderId) {
      tables.support_case_links.push({
        case_id: supportCase.caseId,
        subject_type: "order",
        subject_id: supportCase.orderId
      });
    }
    tables.activities.push({
      activity_id: `act-${supportCase.caseId}`,
      account_id: supportCase.accountId,
      case_id: supportCase.caseId,
      summary: supportCase.summary,
      occurred_at: supportCase.openedAt
    });
  }

  for (const review of fixture.complianceReviews) {
    tables.compliance_reviews.push({
      review_id: review.reviewId,
      account_id: review.accountId,
      order_id: review.orderId,
      opened_at: review.openedAt,
      status: review.status
    });
    for (const flag of review.flags) {
      tables.compliance_review_flags.push({ review_id: review.reviewId, flag });
    }
  }

  tables.escalation_policies.push({
    policy_id: fixture.escalationPolicy.policyId,
    name: fixture.escalationPolicy.name,
    applies_to_status: fixture.escalationPolicy.appliesToStatus,
    min_value_cents: fixture.escalationPolicy.minValueCents,
    customer_visible_title: fixture.escalationPolicy.customerVisibleTitle,
    customer_visible_status: fixture.escalationPolicy.customerVisibleStatus,
    next_step: fixture.escalationPolicy.nextStep,
    customer_message: fixture.escalationPolicy.customerMessage
  });
  fixture.escalationPolicy.ownerGroups.forEach((ownerGroup, index) => {
    tables.escalation_policy_steps.push({
      policy_id: fixture.escalationPolicy.policyId,
      step_order: index + 1,
      owner_group: ownerGroup
    });
  });
  tables.sla_policies.push(...fixture.slaPolicies.map((policy) => ({
    policy_id: policy.policyId,
    account_tier: policy.tier,
    region: policy.region,
    response_minutes: policy.responseMinutes
  })));
  for (const account of fixture.accounts) {
    tables.inventory_locations.push({
      location_id: `loc-${account.accountId}`,
      region: account.region,
      label: `${account.name} primary`
    });
  }
  tables.portal_visibility_rules.push(
    { rule_id: "rule-delayed", status: "delayed", customer_visible: true, title: "Shipment delayed" },
    { rule_id: "rule-escalation-active", status: "customer_escalation_active", customer_visible: true, title: "At-risk escalation active" }
  );

  return tables;
}

function billingSummary(invoices, accountId) {
  const accountInvoices = invoices.filter((invoice) => invoice.accountId === accountId);
  const pastDue = accountInvoices.filter((invoice) => invoice.status === "past_due");
  return {
    invoiceCount: accountInvoices.length,
    pastDueCount: pastDue.length,
    pastDueCents: pastDue.reduce((sum, invoice) => sum + invoice.amountCents, 0),
    oldestPastDueAt: pastDue.map((invoice) => invoice.dueAt).sort()[0] || null,
    riskCodes: pastDue.map((invoice) => invoice.risk).filter(Boolean)
  };
}

function supportSummary(supportCases, accountId) {
  const cases = supportCases.filter((supportCase) => supportCase.accountId === accountId);
  const openCases = cases.filter((supportCase) => supportCase.status !== "closed");
  return {
    openCaseCount: openCases.length,
    urgentCaseCount: openCases.filter((supportCase) => ["high", "urgent"].includes(supportCase.priority)).length,
    latestSummary: latestBy(openCases, "openedAt")?.summary || null
  };
}

function complianceSummary(reviews, accountId) {
  const accountReviews = reviews.filter((review) => review.accountId === accountId);
  const active = accountReviews.filter((review) => review.status !== "cleared");
  return {
    activeReviewCount: active.length,
    flags: [...new Set(active.flatMap((review) => review.flags || []))]
  };
}

function latestBy(items, field) {
  return [...items].sort((a, b) => String(b[field]).localeCompare(String(a[field])))[0] || null;
}

function slug(value) {
  return String(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
}

export function writeJson(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
