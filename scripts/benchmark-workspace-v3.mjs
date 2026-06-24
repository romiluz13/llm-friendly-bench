// AST-Bench V3 — per-run agent workspace generator (live-DB, de-leaked).
//
// Emits a workspace where the agent must:
//   1. connect to the live DB using db-config.json (injected per run),
//   2. read raw account facts,
//   3. DERIVE the workflow answer from the rules in RULES.md (no answer key
//      exists in the data),
//   4. persist workflow_state / owner_tasks / customer_messages / audit_events
//      back to the live DB,
//   5. make `npm test` pass — the test connects to the live DB and checks the
//      persisted rows against the canonical answer recomputed from raw facts.
//
// The workspace ships node DB drivers via a local node_modules symlink to the
// repo root install (see installDrivers), so `npm test` runs offline-fast.

import { cpSync, existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { RULES } from "./benchmark-derive.mjs";

export function writeV3Workspace({ workspace, lane, shape, ns, dbHandle, scenarioId }) {
  mkdirSync(join(workspace, "src"), { recursive: true });
  mkdirSync(join(workspace, "tests"), { recursive: true });

  writeFileSync(join(workspace, "package.json"), JSON.stringify({
    name: `ast-bench-v3-${lane}`,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: { test: "node tests/acceptance.test.mjs" }
  }, null, 2) + "\n");

  writeFileSync(join(workspace, "db-config.json"), JSON.stringify(dbConfig({ lane, ns, dbHandle }), null, 2) + "\n");
  writeFileSync(join(workspace, "RULES.md"), rulesDoc());
  writeFileSync(join(workspace, "README.md"), readmeDoc({ lane }));
  writeFileSync(join(workspace, "AGENTS.md"), agentsDoc({ lane }));
  writeFileSync(join(workspace, "src", "db.mjs"), dbHelper(lane));
  writeFileSync(join(workspace, "src", "workflow.mjs"), workflowStub());
  writeFileSync(join(workspace, "src", "derive.mjs"), deriveRef()); // rules helper the agent MAY use; not the answer
  writeFileSync(join(workspace, "tests", "facts.mjs"), factsBridge({ lane, shape }));
  writeFileSync(join(workspace, "tests", "acceptance.test.mjs"), acceptanceTest({ lane }));

  linkDrivers(workspace);
}

function dbConfig({ lane, ns, dbHandle }) {
  if (lane === "mongo") {
    return { lane, kind: "mongodb", uri: dbHandle.uri, namespace: ns };
  }
  // both postgres lanes connect via the same host-mapped port; schema = ns
  return {
    lane,
    kind: "postgres",
    host: "127.0.0.1",
    port: 5433,
    user: "lab",
    password: "lab",
    database: "sql_hidden_cost",
    schema: ns
  };
}

function rulesDoc() {
  return `# Business rules — Strategic Account Rescue

You must DERIVE the answer from the account's raw facts. There is no answer key
in the data. Apply these rules exactly.

## Qualification
An account qualifies for escalation if BOTH:
- account tier is one of: ${RULES.qualifyingTiers.join(", ")}, AND
- at least one risk signal (below) is active.

If it does NOT qualify, the workflow status is:
  "${RULES.monitorStatus}"
with NO owner tasks.

If it DOES qualify, the workflow status is:
  "${RULES.escalationStatus}"

## Risk signals (active when…)
- Regulatory hold: a regulatory flag with status "open".
- Overdue invoice: an unpaid invoice past its due date AND amount >= $${(RULES.invoiceHighCents / 100).toLocaleString("en-US")}.
- Delayed shipment: a shipment with no delivered date AND past its SLA date.
- Escalated support: an open support case with severity high or critical.
- Usage decline: current period units <= prior period units * ${1 - RULES.usageDropFraction} (a drop of ${Math.round(RULES.usageDropFraction * 100)}% or more).

Report signals in this display order: Regulatory hold, Overdue invoice,
Delayed shipment, Escalated support, Usage decline. Skip any that are inactive.

## Owner routing (derived from which signals fired; dedupe; this fixed order)
- Regulatory hold -> Legal
- Overdue invoice -> Finance
- Delayed shipment -> Customer Success
- Usage decline -> Customer Success
- Escalated support -> Support
Order: Legal, Finance, Customer Success, Support.

## What to persist (to the live database)
- workflow_state: one row/doc with status, next_step, risk_summary.
- owner_tasks: one per owner group, each with title, due_at, status "open".
- customer_messages: one customer-safe message (no internal ids/codes), non-trivial length.
- audit_events: one customer-visible event.

risk_summary format: "<N> signals: <name>, <name>, ...".
next_step: "<top owner> recovery review by 16:00" when qualifying, else "Continue standard monitoring.".
`;
}

function readmeDoc({ lane }) {
  return `# AST-Bench V3 target (${lane})

Implement \`src/workflow.mjs\` so it connects to the live database described in
\`db-config.json\`, reads the account's raw facts, derives the rescue workflow
per \`RULES.md\`, and persists the result back to the database. Then make
\`npm test\` pass. The test reads the live database and checks your persisted
state against the rules.
`;
}

function agentsDoc({ lane }) {
  return `# Target rules
- Connect to the live ${lane} database in db-config.json. Do NOT use a local file as the database.
- DERIVE the answer from RULES.md. Do not hard-code the status/owners/signals.
- Persist results back to the live database.
- Do not edit tests/. Do not change the seeded input data.
- Run \`npm test\` until it passes.
`;
}

// A thin connection helper the agent's workflow + the test both import.
function dbHelper(lane) {
  if (lane === "mongo") {
    return `import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

const cfg = JSON.parse(readFileSync(new URL("../db-config.json", import.meta.url), "utf8"));

export async function withDb(fn) {
  const client = new MongoClient(cfg.uri);
  await client.connect();
  try { return await fn(client.db()); } finally { await client.close(); }
}
export { cfg };
`;
  }
  // postgres (both norm + jsonb) — search_path set to the run schema.
  return `import { readFileSync } from "node:fs";
import pg from "pg";

const cfg = JSON.parse(readFileSync(new URL("../db-config.json", import.meta.url), "utf8"));

export async function withDb(fn) {
  const client = new pg.Client({ host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database });
  await client.connect();
  await client.query('SET search_path TO "' + cfg.schema + '"');
  try { return await fn(client); } finally { await client.end(); }
}
export { cfg };
`;
}

function workflowStub() {
  return `// Implement the rescue workflow. Connect via src/db.mjs, read raw account
// facts, derive the answer per ../RULES.md, and PERSIST workflow_state,
// owner_tasks, customer_messages, audit_events back to the live database.
//
// export an async function run() that performs the full read->derive->persist.
import { withDb, cfg } from "./db.mjs";

export async function run(now = "2026-06-18T12:00:00.000Z") {
  // TODO: implement against the live database in cfg.
  throw new Error("workflow not implemented");
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  run().then(() => console.log("workflow done")).catch((e) => { console.error(e); process.exit(1); });
}
`;
}

// A rules helper the agent may import to compute signals/owners. This encodes
// the RULES.md logic but NOT the final answer for any specific account — it
// operates on whatever facts are passed in, so it is a tool, not an answer key.
function deriveRef() {
  return `// Optional helper: pure functions implementing RULES.md against a normalized
// fact bundle { account, invoices, shipments, regulatoryFlags, supportCases, usage }.
// Using this is allowed; the facts still come from the live DB you must read.
export const RULES = ${JSON.stringify(RULES, null, 2)};
const OWNER_FOR = { regulatory: "Legal", invoice: "Finance", shipment: "Customer Success", usage: "Customer Success", support: "Support" };
const OWNER_ORDER = ["Legal", "Finance", "Customer Success", "Support"];
const SIGNAL_ORDER = ["regulatory", "invoice", "shipment", "support", "usage"];
const SIGNAL_NAME = { regulatory: "Regulatory hold", invoice: "Overdue invoice", shipment: "Delayed shipment", support: "Escalated support", usage: "Usage decline" };
const ms = (d) => Date.parse(d);

export function firedRisks(f, now) {
  const n = ms(now), out = {};
  if ((f.invoices||[]).some((i)=>i.status!=="paid"&&ms(i.dueDate)<n&&i.amountCents>=RULES.invoiceHighCents)) out.invoice=1;
  if ((f.shipments||[]).some((s)=>!s.deliveredDate&&ms(s.slaDate)<n)) out.shipment=1;
  if ((f.regulatoryFlags||[]).some((r)=>r.status==="open")) out.regulatory=1;
  if ((f.supportCases||[]).some((c)=>c.status==="open"&&RULES.highSupportSeverities.includes(c.severity))) out.support=1;
  const u=f.usage||{};
  if (typeof u.priorPeriodUnits==="number"&&u.priorPeriodUnits>0&&u.currentPeriodUnits<=u.priorPeriodUnits*(1-RULES.usageDropFraction)) out.usage=1;
  return out;
}
export function signalsOf(f, now) { const r=firedRisks(f,now); return SIGNAL_ORDER.filter((c)=>r[c]).map((c)=>SIGNAL_NAME[c]); }
export function ownersOf(f, now) { const r=firedRisks(f,now); const s=new Set(Object.keys(r).map((c)=>OWNER_FOR[c])); return OWNER_ORDER.filter((o)=>s.has(o)); }
export function qualifies(f, now) { return RULES.qualifyingTiers.includes(String(f.account?.tier||"").toLowerCase()) && signalsOf(f,now).length>=1; }
`;
}

// The acceptance test: connects to the live DB, runs the agent's workflow,
// reads persisted state, and asserts against the canonical oracle recomputed
// from the raw facts in the DB. Lives in the workspace but imports the shared
// oracle by absolute path so it cannot be gamed by editing a local copy.
function acceptanceTest({ lane }) {
  return `import { strictEqual, deepStrictEqual, ok } from "node:assert";
import { withDb } from "../src/db.mjs";
import { run } from "../src/workflow.mjs";
import { readFactsFromDb, deriveExpected } from "./facts.mjs";

const now = "2026-06-18T12:00:00.000Z";

// 1) read raw facts from the live DB and compute the expected answer.
const facts = await withDb((db) => readFactsFromDb(db));
const expected = deriveExpected(facts, now);

// 2) run the agent's workflow (it must connect + persist to the live DB).
await run(now);

// 3) read persisted state back from the live DB and assert.
const persisted = await withDb((db) => readPersisted(db));

strictEqual(persisted.state?.status, expected.status, "Persisted workflow status");
strictEqual(persisted.state?.risk_summary, expected.riskSummary, "Risk summary");
deepStrictEqual(persisted.owners, expected.owners, "Owner routing (derived)");
strictEqual(persisted.ownerTaskCount, expected.owners.length, "Owner task count");
if (expected.expectsEscalation) {
  ok(persisted.customerMessage && persisted.customerMessage.length > 12, "Customer-safe message present");
  ok(!/acct-|req-|inv-|internal/i.test(persisted.customerMessage), "Customer message must not leak internal ids/codes");
  ok(persisted.auditVisible, "Customer-visible audit event present");
} else {
  strictEqual(persisted.owners.length, 0, "Non-qualifying account must have no owners");
}
console.log("AST-Bench V3 acceptance passed: ${lane}");

${lane === "mongo" ? mongoReadPersisted() : pgReadPersisted()}
`;
}

function mongoReadPersisted() {
  return `async function readPersisted() {
  return withDb(async (db) => {
    const state = (await db.collection("workflow_state").find({}).toArray())[0] || null;
    const tasks = await db.collection("owner_tasks").find({}).toArray();
    const msg = (await db.collection("customer_messages").find({}).toArray())[0] || null;
    const audit = await db.collection("audit_events").find({}).toArray();
    return {
      state: state ? { status: state.status, risk_summary: state.risk_summary || state.riskSummary } : null,
      owners: tasks.map((t) => t.owner_group || t.ownerGroup),
      ownerTaskCount: tasks.length,
      customerMessage: msg?.body || "",
      auditVisible: audit.some((a) => a.customer_visible || a.customerVisible)
    };
  });
}`;
}

function pgReadPersisted() {
  return `async function readPersisted() {
  return withDb(async (c) => {
    const state = (await c.query("SELECT status, risk_summary FROM workflow_state LIMIT 1")).rows[0] || null;
    const tasks = (await c.query("SELECT owner_group FROM owner_tasks")).rows;
    const msg = (await c.query("SELECT body FROM customer_messages LIMIT 1")).rows[0] || null;
    const audit = (await c.query("SELECT customer_visible FROM audit_events")).rows;
    return {
      state,
      owners: tasks.map((t) => t.owner_group),
      ownerTaskCount: tasks.length,
      customerMessage: msg?.body || "",
      auditVisible: audit.some((a) => a.customer_visible === true)
    };
  });
}`;
}

// tests/facts.mjs — re-exports the canonical oracle by ABSOLUTE repo path (so
// the agent cannot weaken it by editing a workspace copy) and reads the raw
// facts back out of the live DB into the lane-independent bundle the oracle
// expects. The agent is told not to edit tests/; a gate also diffs it.
function factsBridge({ lane, shape }) {
  const oraclePath = resolve("scripts/benchmark-derive.mjs");
  const reader = lane === "mongo" ? mongoFactsReader()
    : lane === "postgres-jsonb" ? jsonbFactsReader()
    : normFactsReader(shape);
  return `// AUTO-GENERATED — do not edit. Canonical oracle + live-DB fact reader.
export { deriveExpected } from ${JSON.stringify(oraclePath)};

${reader}
`;
}

function mongoFactsReader() {
  return `export async function readFactsFromDb(db) {
  const a = (await db.collection("accounts").find({}).toArray())[0];
  return {
    account: { accountId: a._id, name: a.name, tier: a.tier, region: a.region },
    contract: a.contract, contacts: a.contacts,
    invoices: a.invoices, shipments: a.shipments,
    regulatoryFlags: a.regulatoryFlags, supportCases: a.supportCases, usage: a.usage
  };
}`;
}

function jsonbFactsReader() {
  return `export async function readFactsFromDb(c) {
  const doc = (await c.query("SELECT doc FROM accounts LIMIT 1")).rows[0].doc;
  return {
    account: { accountId: doc._id, name: doc.name, tier: doc.tier, region: doc.region },
    contract: doc.contract, contacts: doc.contacts,
    invoices: doc.invoices, shipments: doc.shipments,
    regulatoryFlags: doc.regulatoryFlags, supportCases: doc.supportCases, usage: doc.usage
  };
}`;
}

function normFactsReader(shape) {
  if (shape === "shallow") {
    return `export async function readFactsFromDb(c) {
  const r = (await c.query("SELECT * FROM workflow_requests LIMIT 1")).rows[0];
  const acct = (await c.query("SELECT * FROM accounts LIMIT 1")).rows[0];
  return {
    account: { accountId: acct.account_id, name: acct.name, tier: acct.tier, region: acct.region },
    contract: {}, contacts: [],
    invoices: JSON.parse(r.invoices_json || "[]"),
    shipments: JSON.parse(r.shipments_json || "[]"),
    regulatoryFlags: JSON.parse(r.regulatory_json || "[]"),
    supportCases: JSON.parse(r.support_json || "[]"),
    usage: { priorPeriodUnits: Number(r.prior_period_units), currentPeriodUnits: Number(r.current_period_units) }
  };
}`;
  }
  return `export async function readFactsFromDb(c) {
  const acct = (await c.query("SELECT * FROM accounts LIMIT 1")).rows[0];
  const num = (rows, f) => rows.map((x) => ({ ...x, [f]: x[f] == null ? x[f] : Number(x[f]) }));
  const invoices = num((await c.query("SELECT invoice_id, amount_cents, due_date, status FROM invoices")).rows, "amount_cents")
    .map((i) => ({ invoiceId: i.invoice_id, amountCents: i.amount_cents, dueDate: toIso(i.due_date), status: i.status }));
  const shipments = (await c.query("SELECT shipment_id, sla_date, delivered_date, status FROM shipments")).rows
    .map((s) => ({ shipmentId: s.shipment_id, slaDate: toIso(s.sla_date), deliveredDate: s.delivered_date ? toIso(s.delivered_date) : null, status: s.status }));
  const regulatoryFlags = (await c.query("SELECT flag_id, type, status FROM regulatory_flags")).rows
    .map((r) => ({ flagId: r.flag_id, type: r.type, status: r.status }));
  const supportCases = (await c.query("SELECT case_id, severity, status FROM support_cases")).rows
    .map((s) => ({ caseId: s.case_id, severity: s.severity, status: s.status }));
  const u = (await c.query("SELECT prior_period_units, current_period_units FROM usage_periods LIMIT 1")).rows[0] || {};
  return {
    account: { accountId: acct.account_id, name: acct.name, tier: acct.tier, region: acct.region },
    contract: {}, contacts: [],
    invoices, shipments, regulatoryFlags, supportCases,
    usage: { priorPeriodUnits: Number(u.prior_period_units), currentPeriodUnits: Number(u.current_period_units) }
  };
}
function toIso(v) { return v instanceof Date ? v.toISOString() : String(v); }`;
}

// Symlink node_modules from the repo root so the workspace has pg + mongodb
// without a per-run npm install (90 installs would be slow + flaky).
function linkDrivers(workspace) {
  const target = join(workspace, "node_modules");
  if (existsSync(target)) return;
  const repoModules = resolve("node_modules");
  try { symlinkSync(repoModules, target, "dir"); } catch { /* best effort */ }
}
