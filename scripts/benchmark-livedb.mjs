// AST-Bench V3 — live-DB lane adapters + seed/dump/teardown against the real
// Docker MongoDB (:27018) and Postgres (:5433) containers.
//
// Three lanes, ONE lane-independent fact `world` (from benchmark-derive.mjs):
//   mongo          → one document per account in collection `accounts`
//   postgres-norm  → normalized tables (shape gradient applies here)
//   postgres-jsonb → one row per account with a JSONB `doc` column + GIN index
//
// Each run gets an ISOLATED namespace so 90 concurrent-ish runs never collide:
//   mongo:    database  astbench_<ns>
//   postgres: schema    astbench_<ns>   (in db sql_hidden_cost)
//
// We reuse the proven access pattern from seed-local-databases.mjs: `mongosh`
// for Mongo, `docker exec -i psql` for Postgres. No Node DB driver is needed by
// the harness itself (the AGENT workspace gets drivers; see workspace gen).

import { spawnSync } from "node:child_process";

export const MONGO_HOST_PORT = process.env.ASTBENCH_MONGO || "127.0.0.1:27018";
export const PG_CONTAINER = process.env.ASTBENCH_PG_CONTAINER || "sql-hidden-cost-postgres";
export const PG_USER = process.env.ASTBENCH_PG_USER || "lab";
export const PG_DB = process.env.ASTBENCH_PG_DB || "sql_hidden_cost";

export const LANES = ["mongo", "postgres-norm", "postgres-jsonb"];

export function namespace({ shape, lane, agentId, repeat }) {
  return `astbench_${shape}_${lane}_${agentId}_r${repeat}`.replaceAll("-", "_");
}

// ---- low-level runners -----------------------------------------------------

function mongosh(uri, evalScript) {
  const result = spawnSync("mongosh", [uri, "--quiet", "--eval", evalScript], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`mongosh failed: ${result.stderr || result.stdout}`);
  return result.stdout || "";
}

function psql(sql, { json = false } = {}) {
  const args = ["exec", "-i", PG_CONTAINER, "psql", "-v", "ON_ERROR_STOP=1", "-U", PG_USER, "-d", PG_DB];
  if (json) args.push("-At");
  const result = spawnSync("docker", args, { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`psql failed: ${result.stderr || result.stdout}`);
  return result.stdout || "";
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

// ---- world → normalized rows (shape-aware) ---------------------------------

// Build the normalized relational rows from the lane-independent world.
// Shape controls how many tables we split into:
//   shallow  → request row carries denormalized owner/signal-free raw columns
//   moderate → child tables for invoices/shipments/regulatory/support
//   deep     → moderate + a contacts↔owner_candidate junction (reconstruction cost)
// NOTE: NO answer-key columns (no expected_outcome / owner_groups / risk_signals).
function normalizedRows(world, shape) {
  const a = world.account;
  const rows = {
    accounts: [{ account_id: a.accountId, name: a.name, tier: a.tier, region: a.region }],
    contracts: [{ contract_id: world.contract.contractId, account_id: a.accountId, arr_cents: world.contract.arrCents, renewal_date: world.contract.renewalDate, support_plan: world.contract.supportPlan }],
    contacts: world.contacts.map((c) => ({ contact_id: c.contactId, account_id: a.accountId, role: c.role, email: c.email })),
    workflow_requests: [{ request_id: `req-${a.accountId}`, account_id: a.accountId, title: world.label || "Account review", primary_entity: "account" }],
    invoices: world.invoices.map((i) => ({ invoice_id: i.invoiceId, account_id: a.accountId, amount_cents: i.amountCents, due_date: i.dueDate, status: i.status })),
    shipments: world.shipments.map((s) => ({ shipment_id: s.shipmentId, account_id: a.accountId, order_value_cents: s.orderValueCents, sla_date: s.slaDate, delivered_date: s.deliveredDate, status: s.status })),
    regulatory_flags: world.regulatoryFlags.map((r) => ({ flag_id: r.flagId, account_id: a.accountId, type: r.type, status: r.status })),
    support_cases: world.supportCases.map((s) => ({ case_id: s.caseId, account_id: a.accountId, severity: s.severity, status: s.status })),
    usage_periods: [{ account_id: a.accountId, prior_period_units: world.usage.priorPeriodUnits, current_period_units: world.usage.currentPeriodUnits }],
    // output tables (start empty; agent must populate via live writes)
    workflow_state: [],
    owner_tasks: [],
    customer_messages: [],
    audit_events: []
  };
  if (shape === "shallow") {
    // collapse child fact tables back onto the request row (denormalized),
    // keeping account/contract/contacts + the four empty output tables.
    const inv = world.invoices, shp = world.shipments, reg = world.regulatoryFlags, sup = world.supportCases, u = world.usage;
    rows.workflow_requests = [{
      request_id: `req-${a.accountId}`, account_id: a.accountId, title: world.label || "Account review", primary_entity: "account",
      invoices_json: JSON.stringify(inv), shipments_json: JSON.stringify(shp), regulatory_json: JSON.stringify(reg), support_json: JSON.stringify(sup),
      prior_period_units: u.priorPeriodUnits, current_period_units: u.currentPeriodUnits
    }];
    delete rows.invoices; delete rows.shipments; delete rows.regulatory_flags; delete rows.support_cases; delete rows.usage_periods;
  }
  if (shape === "deep") {
    // add a many-to-many reconstruction burden: candidate owner groups + junction.
    rows.owner_candidate_groups = ["Legal", "Finance", "Customer Success", "Support"].map((g, i) => ({ owner_group: g, group_order: i }));
    rows.contact_x_owner_group = world.contacts.flatMap((c) => rows.owner_candidate_groups.map((g) => ({ contact_id: c.contactId, owner_group: g.owner_group })));
  }
  return rows;
}

// column → SQL type (text default; *_cents/_units int; *_json/doc jsonb; *_date timestamptz; customer_visible bool)
function sqlType(col) {
  if (/_cents$|_units$/.test(col)) return "bigint";
  if (/_json$/.test(col) || col === "doc") return "jsonb";
  if (/_date$/.test(col) || /_at$/.test(col) || col === "occurred_at") return "timestamptz";
  if (col === "customer_visible") return "boolean";
  return "text";
}

function createTableSql(schema, table, sampleRow, extraCols = {}) {
  const cols = { ...sampleRow, ...extraCols };
  const defs = Object.keys(cols).map((c) => `  "${c}" ${sqlType(c)}`);
  return `CREATE TABLE "${schema}"."${table}" (\n${defs.join(",\n")}\n);`;
}

function insertSql(schema, table, rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const tuples = rows.map((r) => `(${cols.map((c) => {
    const v = r[c];
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (typeof v === "number") return String(v);
    if (sqlType(c) === "jsonb") return `${sqlString(typeof v === "string" ? v : JSON.stringify(v))}::jsonb`;
    return sqlString(v);
  }).join(", ")})`);
  return `INSERT INTO "${schema}"."${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES\n${tuples.join(",\n")};`;
}

// Empty output-table column contracts (so the schema exists before the agent writes).
const OUTPUT_TABLE_COLS = {
  workflow_state: { request_id: "", account_id: "", title: "", status: "", next_step: "", risk_summary: "" },
  owner_tasks: { request_id: "", account_id: "", owner_group: "", title: "", due_at: null, status: "" },
  customer_messages: { request_id: "", account_id: "", body: "" },
  audit_events: { request_id: "", account_id: "", event: "", occurred_at: null, customer_visible: false }
};

// Input fact-table column contracts — used when a scenario leaves a table empty
// (e.g. a negative control with no shipments), so the table still has the right
// columns for the facts reader to SELECT. Numeric/date typing flows from sqlType.
const INPUT_TABLE_COLS = {
  invoices: { invoice_id: "", account_id: "", amount_cents: 0, due_date: null, status: "" },
  shipments: { shipment_id: "", account_id: "", order_value_cents: 0, sla_date: null, delivered_date: null, status: "" },
  regulatory_flags: { flag_id: "", account_id: "", type: "", status: "" },
  support_cases: { case_id: "", account_id: "", severity: "", status: "" },
  usage_periods: { account_id: "", prior_period_units: 0, current_period_units: 0 }
};

// ---- seed -------------------------------------------------------------------

export function seed({ world, shape, lane, ns }) {
  if (lane === "mongo") return seedMongo(world, ns);
  if (lane === "postgres-jsonb") return seedJsonb(world, ns);
  return seedNorm(world, shape, ns);
}

function mongoDoc(world) {
  // One access-pattern-shaped document holding all account context.
  return {
    _id: world.account.accountId,
    name: world.account.name,
    tier: world.account.tier,
    region: world.account.region,
    contract: world.contract,
    contacts: world.contacts,
    invoices: world.invoices,
    shipments: world.shipments,
    regulatoryFlags: world.regulatoryFlags,
    supportCases: world.supportCases,
    usage: world.usage,
    request: { requestId: `req-${world.account.accountId}`, title: world.label || "Account review", primaryEntity: "account" }
  };
}

function seedMongo(world, ns) {
  const uri = `mongodb://${MONGO_HOST_PORT}/${ns}`;
  const doc = mongoDoc(world);
  const script = `
    db.dropDatabase();
    db.accounts.insertOne(${JSON.stringify(doc)});
    db.workflow_state.deleteMany({});
    db.owner_tasks.deleteMany({});
    db.customer_messages.deleteMany({});
    db.audit_events.deleteMany({});
    print("seeded:" + db.accounts.countDocuments({}));
  `;
  mongosh(uri, script);
  return { uri, kind: "mongo" };
}

function seedNorm(world, shape, ns) {
  const rows = normalizedRows(world, shape);
  const stmts = [`DROP SCHEMA IF EXISTS "${ns}" CASCADE;`, `CREATE SCHEMA "${ns}";`];
  for (const [table, data] of Object.entries(rows)) {
    if (OUTPUT_TABLE_COLS[table]) {
      stmts.push(createTableSql(ns, table, OUTPUT_TABLE_COLS[table]));
      continue;
    }
    // Prefer an explicit column contract (so empty input tables still type
    // their columns correctly); fall back to the first data row's shape.
    const sample = INPUT_TABLE_COLS[table] || data[0] || { id: "" };
    stmts.push(createTableSql(ns, table, sample));
    const ins = insertSql(ns, table, data);
    if (ins) stmts.push(ins);
  }
  psql(stmts.join("\n"));
  return { schema: ns, kind: "postgres-norm" };
}

function seedJsonb(world, ns) {
  const doc = mongoDoc(world);
  const stmts = [
    `DROP SCHEMA IF EXISTS "${ns}" CASCADE;`,
    `CREATE SCHEMA "${ns}";`,
    `CREATE TABLE "${ns}"."accounts" (account_id text PRIMARY KEY, doc jsonb NOT NULL);`,
    `CREATE INDEX ON "${ns}"."accounts" USING GIN (doc);`,
    `INSERT INTO "${ns}"."accounts" (account_id, doc) VALUES (${sqlString(doc._id)}, ${sqlString(JSON.stringify(doc))}::jsonb);`
  ];
  for (const [table, cols] of Object.entries(OUTPUT_TABLE_COLS)) {
    stmts.push(createTableSql(ns, table, cols));
  }
  psql(stmts.join("\n"));
  return { schema: ns, kind: "postgres-jsonb" };
}

// ---- dump (db-before / db-after evidence) ----------------------------------

export function dump({ lane, ns }) {
  if (lane === "mongo") {
    const uri = `mongodb://${MONGO_HOST_PORT}/${ns}`;
    const out = mongosh(uri, `
      const o = {};
      for (const c of db.getCollectionNames()) { o[c] = db.getCollection(c).find({}).toArray(); }
      print(JSON.stringify(o));
    `);
    return out.trim();
  }
  const tableList = psql(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = ${sqlString(ns)} ORDER BY table_name;`,
    { json: true }
  ).trim();
  const tables = tableList ? tableList.split(/\r?\n/).filter(Boolean) : [];
  const result = {};
  for (const table of tables) {
    const json = psql(
      `SELECT coalesce(json_agg(t), '[]'::json)::text FROM "${ns}"."${table}" t;`,
      { json: true }
    ).trim();
    result[table] = JSON.parse(json || "[]");
  }
  return JSON.stringify(result);
}

// ---- teardown ---------------------------------------------------------------

export function teardown({ lane, ns }) {
  try {
    if (lane === "mongo") {
      mongosh(`mongodb://${MONGO_HOST_PORT}/${ns}`, "db.dropDatabase();");
    } else {
      psql(`DROP SCHEMA IF EXISTS "${ns}" CASCADE;`);
    }
  } catch {
    // teardown is best-effort; never fail a run on cleanup.
  }
}
