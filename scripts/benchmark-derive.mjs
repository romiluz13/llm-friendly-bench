// AST-Bench V3 — canonical derivation oracle + de-leaked raw-fact scenarios.
//
// This module is the SINGLE SOURCE OF TRUTH for what a correct answer is. The
// fixtures contain ONLY raw business facts (no expected_outcome, no owner list,
// no risk-signal list, no customer message). The agent must DERIVE the answer
// from raw facts using the business rules documented in the workspace; the
// acceptance test re-derives the expected answer here and checks the agent's
// PERSISTED live-DB state against it. Copying a status string cannot pass,
// because negative-control accounts have a different correct answer.
//
// The rules below are mirrored verbatim, in prose, in the workspace RULES.md so
// the agent and this oracle agree. Rules are lane-independent; only the data
// SHAPE differs between mongo / postgres-norm / postgres-jsonb.

export const NOW = "2026-06-18T12:00:00.000Z";

export const RULES = {
  invoiceHighCents: 2_500_000, // $25,000
  usageDropFraction: 0.30, // >=30% period-over-period decline
  qualifyingTiers: ["strategic", "enterprise"],
  highSupportSeverities: ["high", "critical"],
  escalationStatus:
    "At-risk escalation active with executive recovery owner routing and customer-visible audit history.",
  monitorStatus: "Monitoring — no escalation required."
};

// Fixed category → owner-group mapping and priority order. Owners are derived
// purely from which risk categories fired; order is deterministic.
const OWNER_FOR_CATEGORY = {
  regulatory: "Legal",
  invoice: "Finance",
  shipment: "Customer Success",
  usage: "Customer Success",
  support: "Support"
};
const OWNER_ORDER = ["Legal", "Finance", "Customer Success", "Support"];

// Signal display order + names, keyed by category.
const SIGNAL_ORDER = ["regulatory", "invoice", "shipment", "support", "usage"];
const SIGNAL_NAME = {
  regulatory: "Regulatory hold",
  invoice: "Overdue invoice",
  shipment: "Delayed shipment",
  support: "Escalated support",
  usage: "Usage decline"
};

function ms(date) {
  return Date.parse(date);
}

// Evaluate raw facts → which risk categories fired (with human detail).
// `world` is the lane-independent fact bundle (see scenarios below).
export function evaluateRisks(world, now = NOW) {
  const nowMs = ms(now);
  const fired = {};

  const overdueInvoice = (world.invoices || []).find(
    (inv) => inv.status !== "paid" && ms(inv.dueDate) < nowMs && inv.amountCents >= RULES.invoiceHighCents
  );
  if (overdueInvoice) {
    fired.invoice = `Invoice ${overdueInvoice.invoiceId} for $${Math.round(overdueInvoice.amountCents / 100).toLocaleString("en-US")} past due.`;
  }

  const lateShipment = (world.shipments || []).find(
    (sh) => !sh.deliveredDate && ms(sh.slaDate) < nowMs
  );
  if (lateShipment) {
    fired.shipment = `Shipment ${lateShipment.shipmentId} past its delivery commitment.`;
  }

  const openReg = (world.regulatoryFlags || []).find((flag) => flag.status === "open");
  if (openReg) {
    fired.regulatory = `Open ${openReg.type} regulatory flag (${openReg.flagId}).`;
  }

  const escalatedSupport = (world.supportCases || []).find(
    (c) => c.status === "open" && RULES.highSupportSeverities.includes(c.severity)
  );
  if (escalatedSupport) {
    fired.support = `Support case ${escalatedSupport.caseId} at ${escalatedSupport.severity} severity.`;
  }

  const usage = world.usage || {};
  if (
    typeof usage.priorPeriodUnits === "number" &&
    typeof usage.currentPeriodUnits === "number" &&
    usage.priorPeriodUnits > 0 &&
    usage.currentPeriodUnits <= usage.priorPeriodUnits * (1 - RULES.usageDropFraction)
  ) {
    const dropPct = Math.round((1 - usage.currentPeriodUnits / usage.priorPeriodUnits) * 100);
    fired.usage = `Usage down ${dropPct}% period-over-period.`;
  }

  return fired;
}

// Ordered list of fired signals: [{ category, name, detail }] in SIGNAL_ORDER.
export function deriveSignals(world, now = NOW) {
  const fired = evaluateRisks(world, now);
  return SIGNAL_ORDER.filter((cat) => fired[cat]).map((cat) => ({
    category: cat,
    name: SIGNAL_NAME[cat],
    detail: fired[cat]
  }));
}

// Owners derived from fired categories, deduped, in OWNER_ORDER.
export function deriveOwners(world, now = NOW) {
  const fired = evaluateRisks(world, now);
  const owners = new Set();
  for (const cat of Object.keys(fired)) owners.add(OWNER_FOR_CATEGORY[cat]);
  return OWNER_ORDER.filter((o) => owners.has(o));
}

export function qualifies(world, now = NOW) {
  const tierOk = RULES.qualifyingTiers.includes(String(world.account?.tier || "").toLowerCase());
  return tierOk && deriveSignals(world, now).length >= 1;
}

// The complete expected answer the agent must produce and persist.
export function deriveExpected(world, now = NOW) {
  const q = qualifies(world, now);
  const signals = deriveSignals(world, now);
  const owners = q ? deriveOwners(world, now) : [];
  const status = q ? RULES.escalationStatus : RULES.monitorStatus;
  const nextStep = q ? `${owners[0]} recovery review by 16:00` : "Continue standard monitoring.";
  return {
    qualifies: q,
    status,
    owners,
    signals,
    riskSummary: `${signals.length} signals: ${signals.map((s) => s.name).join(", ")}`,
    nextStep,
    expectsEscalation: q
  };
}

// ---------------------------------------------------------------------------
// Scenarios — raw facts only. One scored positive scenario + negative controls.
// The world is lane-independent; lane adapters (in benchmark-livedb.mjs) shape
// it into a Mongo document / normalized tables / a JSONB row.
// ---------------------------------------------------------------------------

// Primary scored scenario: strategic account, multiple active risks → qualifies.
export const PRIMARY_SCENARIO = {
  id: "strategic-account-rescue",
  label: "Strategic account rescue",
  account: { accountId: "acct-001", name: "Northwind Strategic", tier: "strategic", region: "NA" },
  contract: { contractId: "ctr-001", arrCents: 7_200_000, renewalDate: "2026-09-30", supportPlan: "platinum" },
  contacts: [
    { contactId: "ct-001-ops", role: "Operations", email: "ops@northwind.test" },
    { contactId: "ct-001-fin", role: "Finance", email: "finance@northwind.test" }
  ],
  invoices: [
    { invoiceId: "inv-001", amountCents: 4_100_000, dueDate: "2026-06-01T00:00:00.000Z", status: "overdue" },
    { invoiceId: "inv-002", amountCents: 900_000, dueDate: "2026-07-15T00:00:00.000Z", status: "open" }
  ],
  shipments: [
    { shipmentId: "shp-001", orderValueCents: 5_500_000, slaDate: "2026-06-12T00:00:00.000Z", deliveredDate: null, status: "in_transit" }
  ],
  regulatoryFlags: [
    { flagId: "reg-001", type: "data-residency", status: "open" }
  ],
  supportCases: [
    { caseId: "sup-001", severity: "high", status: "open" }
  ],
  usage: { priorPeriodUnits: 1000, currentPeriodUnits: 620 } // 38% drop
};

// Negative controls — same world shape, different correct answers. Used to
// prove the agent reasons rather than copies. NOT scored into the cost
// aggregate; they gate whether a lane may claim "reasoning".
export const NEGATIVE_CONTROLS = [
  {
    id: "nc-midmarket-noqualify",
    label: "Mid-market, active risk but non-qualifying tier",
    account: { accountId: "acct-nc1", name: "Smallco", tier: "mid-market", region: "NA" },
    contract: { contractId: "ctr-nc1", arrCents: 300_000, renewalDate: "2026-12-31", supportPlan: "standard" },
    contacts: [{ contactId: "ct-nc1", role: "Ops", email: "ops@smallco.test" }],
    invoices: [{ invoiceId: "inv-nc1", amountCents: 3_000_000, dueDate: "2026-06-01T00:00:00.000Z", status: "overdue" }],
    shipments: [],
    regulatoryFlags: [],
    supportCases: [],
    usage: { priorPeriodUnits: 100, currentPeriodUnits: 100 }
    // tier not in {strategic,enterprise} → qualifies=false → monitoring, no owners
  },
  {
    id: "nc-strategic-allclear",
    label: "Strategic account, all risks cleared",
    account: { accountId: "acct-nc2", name: "Bluewave Strategic", tier: "strategic", region: "EU" },
    contract: { contractId: "ctr-nc2", arrCents: 9_000_000, renewalDate: "2026-10-31", supportPlan: "platinum" },
    contacts: [{ contactId: "ct-nc2", role: "Finance", email: "fin@bluewave.test" }],
    invoices: [{ invoiceId: "inv-nc2", amountCents: 4_000_000, dueDate: "2026-06-01T00:00:00.000Z", status: "paid" }],
    shipments: [{ shipmentId: "shp-nc2", orderValueCents: 5_000_000, slaDate: "2026-06-12T00:00:00.000Z", deliveredDate: "2026-06-10T00:00:00.000Z", status: "delivered" }],
    regulatoryFlags: [{ flagId: "reg-nc2", type: "data-residency", status: "cleared" }],
    supportCases: [{ caseId: "sup-nc2", severity: "low", status: "open" }],
    usage: { priorPeriodUnits: 1000, currentPeriodUnits: 980 }
    // no risks fire → qualifies=false → monitoring, no owners
  },
  {
    id: "nc-strategic-regonly",
    label: "Strategic account, single regulatory flag only",
    account: { accountId: "acct-nc3", name: "Cedar Strategic", tier: "enterprise", region: "NA" },
    contract: { contractId: "ctr-nc3", arrCents: 6_000_000, renewalDate: "2026-11-30", supportPlan: "gold" },
    contacts: [{ contactId: "ct-nc3", role: "Legal", email: "legal@cedar.test" }],
    invoices: [{ invoiceId: "inv-nc3", amountCents: 1_000_000, dueDate: "2026-07-20T00:00:00.000Z", status: "open" }],
    shipments: [{ shipmentId: "shp-nc3", orderValueCents: 2_000_000, slaDate: "2026-07-01T00:00:00.000Z", deliveredDate: null, status: "in_transit" }],
    regulatoryFlags: [{ flagId: "reg-nc3", type: "export-control", status: "open" }],
    supportCases: [{ caseId: "sup-nc3", severity: "low", status: "open" }],
    usage: { priorPeriodUnits: 500, currentPeriodUnits: 480 }
    // only regulatory fires (shipment SLA in future, invoice not overdue+high, support low, usage flat)
    // → qualifies=true, signals=[Regulatory hold], owners=[Legal]
  }
];

export const ALL_SCENARIOS = [PRIMARY_SCENARIO, ...NEGATIVE_CONTROLS];
