// Build-Bench complex brownfield workspace generator.
// Produces a workspace with EXISTING working schema + code for a multi-entity
// domain (accounts, orders, lineItems, invoices, supportCases), and a complex
// change request: add a "shipments" entity with a relationship to orders.
//
// This is the enterprise-realistic task: the agent must understand the existing
// multi-entity schema, add a NEW related entity, create the migration, update
// existing queries, and not break anything.
import { mkdirSync, writeFileSync, symlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

export function writeComplexBrownfieldWorkspace({
	workspace,
	lane,
	taskType,
	ns,
	dbHandle,
}) {
	mkdirSync(join(workspace, "src"), { recursive: true });
	mkdirSync(join(workspace, "tests"), { recursive: true });

	writeFileSync(
		join(workspace, "package.json"),
		JSON.stringify(
			{
				name: `build-bench-${lane}-${taskType}`,
				version: "1.0.0",
				private: true,
				type: "module",
				scripts: { test: "node tests/acceptance.test.mjs" },
			},
			null,
			2,
		) + "\n",
	);

	writeFileSync(
		join(workspace, "db-config.json"),
		JSON.stringify(dbConfig({ lane, ns, dbHandle }), null, 2) + "\n",
	);
	writeFileSync(join(workspace, "RULES.md"), rulesDoc());
	writeFileSync(join(workspace, "README.md"), readmeDoc({ lane, taskType }));
	writeFileSync(
		join(workspace, "AGENTS.md"),
		`# Agent Guidelines — ${lane} (complex brownfield)\n\nMulti-entity database with existing code. Read the source files first.\nOnly edit files under \`src/\` except \`src/db.mjs\` (protected).\nDo not edit anything under \`tests/\`.\n`,
	);

	writeFileSync(join(workspace, "src", "db.mjs"), dbHelper(lane));
	writeFileSync(join(workspace, "src", "schema.mjs"), existingSchema(lane));
	writeFileSync(
		join(workspace, "src", "orders.mjs"),
		existingOrdersModel(lane),
	);
	writeFileSync(
		join(workspace, "src", "accounts.mjs"),
		existingAccountsModel(lane),
	);

	writeFileSync(
		join(workspace, "tests", "acceptance.test.mjs"),
		acceptanceTest({ lane }),
	);

	linkDrivers(workspace);
}

function dbConfig({ lane, ns, dbHandle }) {
	if (lane === "mongo")
		return { uri: dbHandle.uri, db: dbHandle.db, namespace: ns };
	return {
		host: dbHandle.host || "127.0.0.1",
		port: dbHandle.port || 5433,
		user: dbHandle.user || "lab",
		password: dbHandle.password || "lab",
		database: dbHandle.database || "sql_hidden_cost",
		schema: ns,
	};
}

function dbHelper(lane) {
	if (lane === "mongo") {
		return `import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";
const cfg = JSON.parse(readFileSync(new URL("../db-config.json", import.meta.url), "utf8"));
export async function withDb(fn) {
  const client = new MongoClient(cfg.uri);
  await client.connect();
  try { return await fn(client.db(cfg.db)); } finally { await client.close(); }
}
export { cfg };
`;
	}
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

// EXISTING schema: accounts, orders, line_items, invoices, support_cases
function existingSchema(lane) {
	if (lane === "mongo") {
		return `import { withDb } from "./db.mjs";

export async function ensureSchema(db) {
  const cols = await db.listCollections().toArray();
  const names = cols.map(c => c.name);

  if (!names.includes("accounts")) {
    await db.createCollection("accounts", { validator: { $jsonSchema: {
      bsonType: "object", required: ["accountId", "name", "tier", "status"],
      properties: {
        accountId: { bsonType: "string" },
        name: { bsonType: "string" },
        tier: { enum: ["strategic", "midmarket", "standard"] },
        status: { enum: ["active", "at-risk", "churned"] },
      }
    }});
  }
  if (!names.includes("orders")) {
    await db.createCollection("orders", { validator: { $jsonSchema: {
      bsonType: "object", required: ["orderId", "accountId", "status", "totalCents"],
      properties: {
        orderId: { bsonType: "string" },
        accountId: { bsonType: "string" },
        status: { enum: ["pending", "fulfilled", "cancelled"] },
        totalCents: { bsonType: ["int", "double"] },
        lineItems: { bsonType: "array", items: { bsonType: "object" } },
      }
    }});
  }
  if (!names.includes("invoices")) {
    await db.createCollection("invoices", { validator: { $jsonSchema: {
      bsonType: "object", required: ["invoiceId", "accountId", "amountCents", "status"],
      properties: {
        invoiceId: { bsonType: "string" },
        accountId: { bsonType: "string" },
        amountCents: { bsonType: ["int", "double"] },
        status: { enum: ["paid", "overdue", "pending"] },
      }
    }});
  }
  if (!names.includes("support_cases")) {
    await db.createCollection("support_cases", { validator: { $jsonSchema: {
      bsonType: "object", required: ["caseId", "accountId", "priority", "status"],
      properties: {
        caseId: { bsonType: "string" },
        accountId: { bsonType: "string" },
        priority: { enum: ["low", "medium", "high", "critical"] },
        status: { enum: ["open", "resolved", "escalated"] },
      }
    }});
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  withDb((db) => ensureSchema(db)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`;
	}
	if (lane === "postgres-norm") {
		return `import { withDb } from "./db.mjs";

export async function ensureSchema(client) {
  await client.query(\`
    CREATE TABLE IF NOT EXISTS accounts (
      account_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tier TEXT NOT NULL CHECK (tier IN ('strategic','midmarket','standard')),
      status TEXT NOT NULL CHECK (status IN ('active','at-risk','churned'))
    )
  \`);
  await client.query(\`
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(account_id),
      status TEXT NOT NULL CHECK (status IN ('pending','fulfilled','cancelled')),
      total_cents INTEGER NOT NULL DEFAULT 0
    )
  \`);
  await client.query(\`
    CREATE TABLE IF NOT EXISTS line_items (
      line_item_id SERIAL PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(order_id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_cents INTEGER NOT NULL DEFAULT 0
    )
  \`);
  await client.query(\`
    CREATE TABLE IF NOT EXISTS invoices (
      invoice_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(account_id),
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('paid','overdue','pending'))
    )
  \`);
  await client.query(\`
    CREATE TABLE IF NOT EXISTS support_cases (
      case_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(account_id),
      priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')),
      status TEXT NOT NULL CHECK (status IN ('open','resolved','escalated'))
    )
  \`);
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  withDb((client) => ensureSchema(client)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`;
	}
	if (lane === "postgres-jsonb") {
		return `import { withDb } from "./db.mjs";

export async function ensureSchema(client) {
  await client.query(\`
    CREATE TABLE IF NOT EXISTS accounts (
      account_id TEXT PRIMARY KEY,
      doc JSONB NOT NULL,
      CONSTRAINT accounts_key_match CHECK (doc->>'accountId' = account_id)
    )
  \`);
  await client.query('CREATE INDEX IF NOT EXISTS idx_accounts_doc ON accounts USING GIN (doc jsonb_path_ops)');

  await client.query(\`
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      doc JSONB NOT NULL,
      CONSTRAINT orders_key_match CHECK (doc->>'orderId' = order_id)
    )
  \`);
  await client.query('CREATE INDEX IF NOT EXISTS idx_orders_doc ON orders USING GIN (doc jsonb_path_ops)');

  await client.query(\`
    CREATE TABLE IF NOT EXISTS invoices (
      invoice_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      doc JSONB NOT NULL,
      CONSTRAINT invoices_key_match CHECK (doc->>'invoiceId' = invoice_id)
    )
  \`);

  await client.query(\`
    CREATE TABLE IF NOT EXISTS support_cases (
      case_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      doc JSONB NOT NULL,
      CONSTRAINT cases_key_match CHECK (doc->>'caseId' = case_id)
    )
  \`);
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  withDb((client) => ensureSchema(client)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`;
	}
	throw new Error(`No schema for lane ${lane}`);
}

function existingOrdersModel(lane) {
	if (lane === "mongo") {
		return `import { ensureSchema } from "./schema.mjs";

export async function createOrder(db, data) {
  await ensureSchema(db);
  const result = await db.collection("orders").insertOne(data);
  return { _id: result.insertedId, ...data };
}

export async function getOrder(db, orderId) {
  return db.collection("orders").findOne({ orderId });
}

export async function getOrdersByAccount(db, accountId) {
  return db.collection("orders").find({ accountId }).toArray();
}

export async function updateOrderStatus(db, orderId, status) {
  await db.collection("orders").updateOne({ orderId }, { $set: { status } });
  return db.collection("orders").findOne({ orderId });
}
`;
	}
	if (lane === "postgres-norm") {
		return `import { ensureSchema } from "./schema.mjs";

function rowToOrder(r) {
  return { orderId: r.order_id, accountId: r.account_id, status: r.status, totalCents: r.total_cents };
}

export async function createOrder(client, data) {
  await ensureSchema(client);
  const res = await client.query(
    'INSERT INTO orders (order_id, account_id, status, total_cents) VALUES ($1, $2, $3, $4) RETURNING *',
    [data.orderId, data.accountId, data.status, data.totalCents || 0]
  );
  // Insert line items if provided
  if (data.lineItems) {
    for (const li of data.lineItems) {
      await client.query(
        'INSERT INTO line_items (order_id, product_name, quantity, unit_price_cents) VALUES ($1, $2, $3, $4)',
        [data.orderId, li.productName || li.product, li.quantity || 1, li.unitPriceCents || 0]
      );
    }
  }
  return rowToOrder(res.rows[0]);
}

export async function getOrder(client, orderId) {
  const res = await client.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
  if (!res.rows[0]) return null;
  const order = rowToOrder(res.rows[0]);
  const items = await client.query('SELECT * FROM line_items WHERE order_id = $1', [orderId]);
  order.lineItems = items.rows.map(r => ({ productName: r.product_name, quantity: r.quantity, unitPriceCents: r.unit_price_cents }));
  return order;
}

export async function getOrdersByAccount(client, accountId) {
  const res = await client.query('SELECT * FROM orders WHERE account_id = $1', [accountId]);
  return res.rows.map(rowToOrder);
}

export async function updateOrderStatus(client, orderId, status) {
  await client.query('UPDATE orders SET status = $1 WHERE order_id = $2', [status, orderId]);
  const res = await client.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
  return res.rows[0] ? rowToOrder(res.rows[0]) : null;
}
`;
	}
	if (lane === "postgres-jsonb") {
		return `import { ensureSchema } from "./schema.mjs";

export async function createOrder(client, data) {
  await ensureSchema(client);
  const doc = { ...data };
  await client.query('INSERT INTO orders (order_id, account_id, doc) VALUES ($1, $2, $3) RETURNING doc', [doc.orderId, doc.accountId, JSON.stringify(doc)]);
  return doc;
}

export async function getOrder(client, orderId) {
  const res = await client.query('SELECT doc FROM orders WHERE order_id = $1', [orderId]);
  return res.rows[0]?.doc || null;
}

export async function getOrdersByAccount(client, accountId) {
  const res = await client.query('SELECT doc FROM orders WHERE account_id = $1', [accountId]);
  return res.rows.map(r => r.doc);
}

export async function updateOrderStatus(client, orderId, status) {
  const existing = await getOrder(client, orderId);
  if (!existing) return null;
  const updated = { ...existing, status };
  await client.query('UPDATE orders SET doc = $1 WHERE order_id = $2', [JSON.stringify(updated), orderId]);
  return updated;
}
`;
	}
	throw new Error(`No orders model for lane ${lane}`);
}

function existingAccountsModel(lane) {
	if (lane === "mongo") {
		return `import { ensureSchema } from "./schema.mjs";

export async function createAccount(db, data) {
  await ensureSchema(db);
  const result = await db.collection("accounts").insertOne(data);
  return { _id: result.insertedId, ...data };
}

export async function getAccount(db, accountId) {
  return db.collection("accounts").findOne({ accountId });
}

export async function updateAccount(db, accountId, data) {
  await db.collection("accounts").updateOne({ accountId }, { $set: data });
  return db.collection("accounts").findOne({ accountId });
}
`;
	}
	if (lane === "postgres-norm") {
		return `import { ensureSchema } from "./schema.mjs";

function rowToAccount(r) {
  return { accountId: r.account_id, name: r.name, tier: r.tier, status: r.status };
}

export async function createAccount(client, data) {
  await ensureSchema(client);
  const res = await client.query(
    'INSERT INTO accounts (account_id, name, tier, status) VALUES ($1, $2, $3, $4) RETURNING *',
    [data.accountId, data.name, data.tier, data.status]
  );
  return rowToAccount(res.rows[0]);
}

export async function getAccount(client, accountId) {
  const res = await client.query('SELECT * FROM accounts WHERE account_id = $1', [accountId]);
  return res.rows[0] ? rowToAccount(res.rows[0]) : null;
}

export async function updateAccount(client, accountId, data) {
  const sets = [], vals = [];
  let i = 1;
  if (data.name !== undefined) { sets.push(\`name = $\${i++}\`); vals.push(data.name); }
  if (data.tier !== undefined) { sets.push(\`tier = $\${i++}\`); vals.push(data.tier); }
  if (data.status !== undefined) { sets.push(\`status = $\${i++}\`); vals.push(data.status); }
  if (sets.length === 0) return getAccount(client, accountId);
  vals.push(accountId);
  await client.query(\`UPDATE accounts SET \${sets.join(', ')} WHERE account_id = $\${i}\`, vals);
  const res = await client.query('SELECT * FROM accounts WHERE account_id = $1', [accountId]);
  return res.rows[0] ? rowToAccount(res.rows[0]) : null;
}
`;
	}
	if (lane === "postgres-jsonb") {
		return `import { ensureSchema } from "./schema.mjs";

export async function createAccount(client, data) {
  await ensureSchema(client);
  const doc = { ...data };
  await client.query('INSERT INTO accounts (account_id, doc) VALUES ($1, $2) RETURNING doc', [doc.accountId, JSON.stringify(doc)]);
  return doc;
}

export async function getAccount(client, accountId) {
  const res = await client.query('SELECT doc FROM accounts WHERE account_id = $1', [accountId]);
  return res.rows[0]?.doc || null;
}

export async function updateAccount(client, accountId, data) {
  const existing = await getAccount(client, accountId);
  if (!existing) return null;
  const updated = { ...existing, ...data };
  await client.query('UPDATE accounts SET doc = $1 WHERE account_id = $2', [JSON.stringify(updated), accountId]);
  return updated;
}
`;
	}
	throw new Error(`No accounts model for lane ${lane}`);
}

// Acceptance test: regression (existing entities work) + new (shipments entity works)
function acceptanceTest({ lane }) {
	if (lane === "mongo") {
		return `import { strictEqual, ok } from "node:assert";
import { withDb } from "../src/db.mjs";
import { ensureSchema } from "../src/schema.mjs";
import { createAccount, getAccount } from "../src/accounts.mjs";
import { createOrder, getOrder, getOrdersByAccount, updateOrderStatus } from "../src/orders.mjs";

await withDb(async (db) => {
  await ensureSchema(db);

  // === REGRESSION: existing entities work ===
  const acct = await createAccount(db, { accountId: "acct-test-1", name: "Test Account", tier: "strategic", status: "active" });
  ok(acct.accountId, "regression: account created");

  const order = await createOrder(db, { orderId: "ord-test-1", accountId: "acct-test-1", status: "pending", totalCents: 50000, lineItems: [{ productName: "Widget", quantity: 5, unitPriceCents: 10000 }] });
  ok(order.orderId, "regression: order created");

  const fetched = await getOrder(db, "ord-test-1");
  strictEqual(fetched.status, "pending", "regression: order fetched");

  const byAcct = await getOrdersByAccount(db, "acct-test-1");
  strictEqual(byAcct.length, 1, "regression: orders by account");

  const updated = await updateOrderStatus(db, "ord-test-1", "fulfilled");
  strictEqual(updated.status, "fulfilled", "regression: order status updated");

  // === NEW: shipments entity ===
  // The agent must implement createShipment, getShipment, getShipmentsByOrder in src/shipments.mjs
  const { createShipment, getShipment, getShipmentsByOrder } = await import("../src/shipments.mjs");

  const ship = await createShipment(db, {
    shipmentId: "shp-test-1",
    orderId: "ord-test-1",
    carrier: "FedEx",
    trackingNumber: "FX123456",
    status: "in_transit",
    shippedAt: new Date(),
  });
  ok(ship.shipmentId, "new: shipment created");

  // verify shipment is in the live DB
  const liveShip = await db.collection("shipments").findOne({ shipmentId: "shp-test-1" });
  ok(liveShip, "new: shipment exists in live DB");
  strictEqual(liveShip.carrier, "FedEx", "new: live DB has correct carrier");

  const fetchedShip = await getShipment(db, "shp-test-1");
  strictEqual(fetchedShip.trackingNumber, "FX123456", "new: shipment fetched");

  const byOrder = await getShipmentsByOrder(db, "ord-test-1");
  strictEqual(byOrder.length, 1, "new: shipments by order");
  strictEqual(byOrder[0].status, "in_transit", "new: shipment status correct");
});

console.log("Build-Bench complex brownfield acceptance passed: ${lane}/new-entity");
`;
	}
	if (lane === "postgres-norm") {
		return `import { strictEqual, ok } from "node:assert";
import { withDb } from "../src/db.mjs";
import { ensureSchema } from "../src/schema.mjs";
import { createAccount } from "../src/accounts.mjs";
import { createOrder, getOrder, getOrdersByAccount, updateOrderStatus } from "../src/orders.mjs";

await withDb(async (client) => {
  await ensureSchema(client);

  // === REGRESSION ===
  const acct = await createAccount(client, { accountId: "acct-test-1", name: "Test Account", tier: "strategic", status: "active" });
  ok(acct.accountId, "regression: account created");

  const order = await createOrder(client, { orderId: "ord-test-1", accountId: "acct-test-1", status: "pending", totalCents: 50000, lineItems: [{ productName: "Widget", quantity: 5, unitPriceCents: 10000 }] });
  ok(order.orderId, "regression: order created");

  const fetched = await getOrder(client, "ord-test-1");
  strictEqual(fetched.status, "pending", "regression: order fetched");

  const byAcct = await getOrdersByAccount(client, "acct-test-1");
  strictEqual(byAcct.length, 1, "regression: orders by account");

  const updated = await updateOrderStatus(client, "ord-test-1", "fulfilled");
  strictEqual(updated.status, "fulfilled", "regression: order status updated");

  // === NEW: shipments entity ===
  const { createShipment, getShipment, getShipmentsByOrder } = await import("../src/shipments.mjs");

  const ship = await createShipment(client, {
    shipmentId: "shp-test-1",
    orderId: "ord-test-1",
    carrier: "FedEx",
    trackingNumber: "FX123456",
    status: "in_transit",
    shippedAt: new Date(),
  });
  ok(ship.shipmentId, "new: shipment created");

  // verify in live DB (snake_case columns)
  const liveShip = (await client.query('SELECT * FROM shipments WHERE shipment_id = $1', ["shp-test-1"])).rows[0];
  ok(liveShip, "new: shipment exists in live DB");
  strictEqual(liveShip.carrier, "FedEx", "new: live DB has correct carrier");
  strictEqual(liveShip.order_id, "ord-test-1", "new: FK to order exists");

  const fetchedShip = await getShipment(client, "shp-test-1");
  strictEqual(fetchedShip.trackingNumber, "FX123456", "new: shipment fetched");

  const byOrder = await getShipmentsByOrder(client, "ord-test-1");
  strictEqual(byOrder.length, 1, "new: shipments by order");
  strictEqual(byOrder[0].status, "in_transit", "new: shipment status correct");
});

console.log("Build-Bench complex brownfield acceptance passed: ${lane}/new-entity");
`;
	}
	if (lane === "postgres-jsonb") {
		return `import { strictEqual, ok } from "node:assert";
import { withDb } from "../src/db.mjs";
import { ensureSchema } from "../src/schema.mjs";
import { createAccount } from "../src/accounts.mjs";
import { createOrder, getOrder, getOrdersByAccount, updateOrderStatus } from "../src/orders.mjs";

await withDb(async (client) => {
  await ensureSchema(client);

  // === REGRESSION ===
  const acct = await createAccount(client, { accountId: "acct-test-1", name: "Test Account", tier: "strategic", status: "active" });
  ok(acct.accountId, "regression: account created");

  const order = await createOrder(client, { orderId: "ord-test-1", accountId: "acct-test-1", status: "pending", totalCents: 50000, lineItems: [{ productName: "Widget", quantity: 5, unitPriceCents: 10000 }] });
  ok(order.orderId, "regression: order created");

  const fetched = await getOrder(client, "ord-test-1");
  strictEqual(fetched.status, "pending", "regression: order fetched");

  const byAcct = await getOrdersByAccount(client, "acct-test-1");
  strictEqual(byAcct.length, 1, "regression: orders by account");

  const updated = await updateOrderStatus(client, "ord-test-1", "fulfilled");
  strictEqual(updated.status, "fulfilled", "regression: order status updated");

  // === NEW: shipments entity ===
  const { createShipment, getShipment, getShipmentsByOrder } = await import("../src/shipments.mjs");

  const ship = await createShipment(client, {
    shipmentId: "shp-test-1",
    orderId: "ord-test-1",
    carrier: "FedEx",
    trackingNumber: "FX123456",
    status: "in_transit",
    shippedAt: new Date(),
  });
  ok(ship.shipmentId, "new: shipment created");

  // verify in live DB (JSONB doc)
  const liveShip = (await client.query('SELECT doc FROM shipments WHERE shipment_id = $1', ["shp-test-1"])).rows[0];
  ok(liveShip, "new: shipment exists in live DB");
  strictEqual(liveShip.doc.carrier, "FedEx", "new: live DB has correct carrier");

  const fetchedShip = await getShipment(client, "shp-test-1");
  strictEqual(fetchedShip.trackingNumber, "FX123456", "new: shipment fetched");

  const byOrder = await getShipmentsByOrder(client, "ord-test-1");
  strictEqual(byOrder.length, 1, "new: shipments by order");
  strictEqual(byOrder[0].status, "in_transit", "new: shipment status correct");
});

console.log("Build-Bench complex brownfield acceptance passed: ${lane}/new-entity");
`;
	}
	throw new Error(`No acceptance test for lane ${lane}`);
}

function rulesDoc() {
	return `# Build-Bench Complex Brownfield — new-entity task

## Existing system

The database has 4 existing entities with working code:
- **accounts** (src/accounts.mjs): accountId, name, tier, status
- **orders** (src/orders.mjs): orderId, accountId, status, totalCents, lineItems
- **invoices**: invoiceId, accountId, amountCents, status
- **support_cases**: caseId, accountId, priority, status

Read \`src/schema.mjs\`, \`src/orders.mjs\`, and \`src/accounts.mjs\` to understand the existing schema and code patterns.

## Change request

Add a **shipments** entity with a relationship to orders:
- Fields: shipmentId (string, PK), orderId (string, FK to orders), carrier (string), trackingNumber (string), status (enum: pending/in_transit/delivered/returned), shippedAt (date)
- Implement CRUD in a new file \`src/shipments.mjs\`: createShipment, getShipment, getShipmentsByOrder
- Update \`src/schema.mjs\` to create the shipments table/collection

## Rules

- Do NOT break existing functionality — regression tests must pass.
- Connect to the real database via \`src/db.mjs\` (do NOT edit this file).
- Edit files under \`src/\` EXCEPT \`src/db.mjs\`. Do NOT modify anything under \`tests/\`.
- Do NOT add any file-based or in-memory fallback.
- Do NOT read skill files, run code reviews, or launch subagents. Just do the task directly.
- Do NOT read any files outside this workspace directory.
- Follow the existing code patterns in src/orders.mjs and src/accounts.mjs.
`;
}

function readmeDoc({ lane, taskType }) {
	return `# Build-Bench Complex Brownfield — ${lane} / ${taskType}

Multi-entity database (accounts, orders, invoices, support_cases) with working code.
Your task: add a **shipments** entity related to orders. Create \`src/shipments.mjs\` and update \`src/schema.mjs\`.

\`\`\`sh
npm test
\`\`\`

Edit \`src/schema.mjs\` and create \`src/shipments.mjs\`. Do not edit \`src/db.mjs\` or anything under \`tests/\`.
`;
}

function linkDrivers(workspace) {
	const repoModules = join(import.meta.dirname, "..", "node_modules");
	if (existsSync(repoModules)) {
		try {
			symlinkSync(repoModules, join(workspace, "node_modules"), "dir");
		} catch {
			/* already exists */
		}
	}
}
