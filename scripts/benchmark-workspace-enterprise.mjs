// Build-Bench enterprise workspace generator.
// 40-entity schema (Postgres) / 21-collection schema (MongoDB).
// Task: add preferredPaymentMethod to accounts + update the order summary query.
// This tests CONTEXT BURDEN — the agent must read and understand a large
// existing schema before it can safely make a change.
import {
	mkdirSync,
	writeFileSync,
	symlinkSync,
	existsSync,
	readFileSync,
} from "node:fs";
import { join } from "node:path";
import {
	generateMongoSchema,
	generatePostgresSchema,
} from "./enterprise-schema-gen.mjs";

export function writeEnterpriseWorkspace({
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
	writeFileSync(
		join(workspace, "README.md"),
		`# Build-Bench Enterprise — ${lane}\n\n40-entity enterprise schema. Task: add preferredPaymentMethod to accounts + update order summary.\n\n\`\`\`sh\nnpm test\n\`\`\`\n`,
	);
	writeFileSync(
		join(workspace, "AGENTS.md"),
		`# Agent — ${lane} (enterprise)\n\nLarge existing schema. Read src/schema.mjs and src/queries.mjs first.\nOnly edit src/ files except src/db.mjs. Do not edit tests/.\nDo NOT read skill files, run code reviews, or launch subagents.\n`,
	);

	writeFileSync(join(workspace, "src", "db.mjs"), dbHelper(lane));

	// Copy the schema generator into the workspace so it can be imported
	const schemaGenSrc = readFileSync(
		join(import.meta.dirname, "enterprise-schema-gen.mjs"),
		"utf8",
	);
	mkdirSync(join(workspace, "scripts"), { recursive: true });
	writeFileSync(
		join(workspace, "scripts", "enterprise-schema-gen.mjs"),
		schemaGenSrc,
	);

	writeFileSync(join(workspace, "src", "schema.mjs"), existingSchema(lane));
	writeFileSync(
		join(workspace, "src", "accounts.mjs"),
		existingAccountsModel(lane),
	);
	writeFileSync(
		join(workspace, "src", "queries.mjs"),
		existingOrderSummaryQuery(lane),
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

function existingSchema(lane) {
	if (lane === "mongo") {
		const schema = generateMongoSchema();
		// Convert the ensureSchema function to a string that imports withDb
		return `import { withDb } from "./db.mjs";

// Enterprise schema: 21 collections with embedded arrays.
// This creates the full 40-entity domain as MongoDB collections.
${schema.ensureSchemaStr || schemaToMongoStr(schema)}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  withDb((db) => ensureSchema(db)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`;
	}
	if (lane === "postgres-norm" || lane === "postgres-jsonb") {
		const schema = generatePostgresSchema();
		return `import { withDb } from "./db.mjs";

// Enterprise schema: 40 tables with 3NF normalization, FKs, CHECK constraints.
${schema.ensureSchemaStr || schemaToPgStr(schema)}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  withDb((client) => ensureSchema(client)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`;
	}
	throw new Error(`No schema for lane ${lane}`);
}

// Convert schema object to a string containing the ensureSchema function
function schemaToMongoStr(schema) {
	return `export async function ensureSchema(db) {
  const { generateMongoSchema } = await import("../scripts/enterprise-schema-gen.mjs");
  const gen = generateMongoSchema();
  await gen.ensureSchema(db);
}`;
}

function schemaToPgStr(schema) {
	return `export async function ensureSchema(client) {
	const { generatePostgresSchema } = await import("../scripts/enterprise-schema-gen.mjs");
	const gen = generatePostgresSchema();
	await gen.ensureSchema(client);
}`;
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
  if (!r) return null;
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
  return rowToAccount(res.rows[0]);
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
  return rowToAccount(res.rows[0]);
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

// The order summary query — this is what the agent must modify
// Postgres: joins 8+ tables. MongoDB: reads 2 documents.
function existingOrderSummaryQuery(lane) {
	if (lane === "mongo") {
		return `import { ensureSchema } from "./schema.mjs";

// Order summary: combines order + account + line items + invoice info
export async function getOrderSummary(db, orderId) {
  await ensureSchema(db);
  const order = await db.collection("orders").findOne({ orderId });
  if (!order) return null;
  const account = await db.collection("accounts").findOne({ accountId: order.accountId });
  const invoice = await db.collection("invoices").findOne({ orderId });
  return {
    orderId: order.orderId,
    status: order.status,
    totalCents: order.totalCents,
    lineItems: order.lineItems || [],
    accountName: account?.name,
    accountTier: account?.tier,
    invoiceStatus: invoice?.status,
    invoiceAmountCents: invoice?.amountCents,
  };
}
`;
	}
	if (lane === "postgres-norm") {
		return `import { ensureSchema } from "./schema.mjs";

// Order summary: joins orders + accounts + order_line_items + invoices
// This is the query the agent must modify to include preferredPaymentMethod
export async function getOrderSummary(client, orderId) {
  await ensureSchema(client);
  const res = await client.query(\`
    SELECT
      o.order_id as "orderId",
      o.status,
      o.total_cents as "totalCents",
      a.name as "accountName",
      a.tier as "accountTier",
      i.status as "invoiceStatus",
      i.amount_cents as "invoiceAmountCents"
    FROM orders o
    JOIN accounts a ON o.account_id = a.account_id
    LEFT JOIN invoices i ON i.order_id = o.order_id
    WHERE o.order_id = $1
  \`, [orderId]);

  if (!res.rows[0]) return null;

  const items = await client.query(
    'SELECT product_name as "productName", quantity, unit_price_cents as "unitPriceCents" FROM order_line_items WHERE order_id = $1',
    [orderId]
  );

  return {
    ...res.rows[0],
    lineItems: items.rows,
  };
}
`;
	}
	if (lane === "postgres-jsonb") {
		return `import { ensureSchema } from "./schema.mjs";

// Order summary: reads orders + accounts docs (JSONB)
export async function getOrderSummary(client, orderId) {
  await ensureSchema(client);
  const orderRes = await client.query('SELECT doc FROM orders WHERE order_id = $1', [orderId]);
  if (!orderRes.rows[0]) return null;
  const order = orderRes.rows[0].doc;

  const acctRes = await client.query('SELECT doc FROM accounts WHERE account_id = $1', [order.accountId]);
  const account = acctRes.rows[0]?.doc;

  const invRes = await client.query('SELECT doc FROM invoices WHERE order_id = $1', [orderId]);
  const invoice = invRes.rows[0]?.doc;

  return {
    orderId: order.orderId,
    status: order.status,
    totalCents: order.totalCents,
    lineItems: order.lineItems || [],
    accountName: account?.name,
    accountTier: account?.tier,
    invoiceStatus: invoice?.status,
    invoiceAmountCents: invoice?.amountCents,
  };
}
`;
	}
	throw new Error(`No query model for lane ${lane}`);
}

// Acceptance test: regression (existing entities + query work) + new (preferredPaymentMethod)
function acceptanceTest({ lane }) {
	if (lane === "mongo") {
		return `import { strictEqual, ok } from "node:assert";
import { withDb } from "../src/db.mjs";
import { ensureSchema } from "../src/schema.mjs";
import { createAccount, getAccount, updateAccount } from "../src/accounts.mjs";
import { getOrderSummary } from "../src/queries.mjs";

await withDb(async (db) => {
  await ensureSchema(db);

  // === REGRESSION: existing entities + query work ===
  const acct = await createAccount(db, { accountId: "acct-ent-1", name: "Enterprise Corp", tier: "strategic", status: "active" });
  ok(acct.accountId, "regression: account created");

  // Create an order
  await db.collection("orders").insertOne({
    orderId: "ord-ent-1", accountId: "acct-ent-1", status: "pending", totalCents: 75000, currency: "USD", createdAt: new Date(),
    lineItems: [{ productName: "Enterprise License", quantity: 1, unitPriceCents: 75000 }]
  });

  // Create an invoice
  await db.collection("invoices").insertOne({
    invoiceId: "inv-ent-1", orderId: "ord-ent-1", accountId: "acct-ent-1", invoiceNumber: "INV-001", amountCents: 75000, totalCents: 75000, status: "sent", currency: "USD", issuedAt: new Date(), dueAt: new Date(),
  });

  // Order summary works
  const summary = await getOrderSummary(db, "ord-ent-1");
  ok(summary, "regression: order summary returned");
  strictEqual(summary.orderId, "ord-ent-1", "regression: order ID matches");
  strictEqual(summary.accountName, "Enterprise Corp", "regression: account name in summary");
  strictEqual(summary.invoiceStatus, "sent", "regression: invoice status in summary");

  // === NEW: preferredPaymentMethod field ===
  const updated = await updateAccount(db, "acct-ent-1", { preferredPaymentMethod: "wire_transfer" });
  strictEqual(updated.preferredPaymentMethod, "wire_transfer", "new: account has preferredPaymentMethod");

  // Verify in live DB
  const liveAcct = await db.collection("accounts").findOne({ accountId: "acct-ent-1" });
  strictEqual(liveAcct.preferredPaymentMethod, "wire_transfer", "new: live DB has preferredPaymentMethod");

  // Order summary must now include preferredPaymentMethod
  const summaryWithPayment = await getOrderSummary(db, "ord-ent-1");
  strictEqual(summaryWithPayment.preferredPaymentMethod, "wire_transfer", "new: order summary includes preferredPaymentMethod");
});

console.log("Build-Bench enterprise acceptance passed: ${lane}");
`;
	}
	if (lane === "postgres-norm") {
		return `import { strictEqual, ok } from "node:assert";
import { withDb } from "../src/db.mjs";
import { ensureSchema } from "../src/schema.mjs";
import { createAccount, getAccount, updateAccount } from "../src/accounts.mjs";
import { getOrderSummary } from "../src/queries.mjs";

await withDb(async (client) => {
  await ensureSchema(client);

  // === REGRESSION ===
  const acct = await createAccount(client, { accountId: "acct-ent-1", name: "Enterprise Corp", tier: "strategic", status: "active" });
  ok(acct.accountId, "regression: account created");

  await client.query("INSERT INTO orders (order_id, account_id, status, total_cents, currency, created_at) VALUES ($1, $2, $3, $4, $5, $6)", ["ord-ent-1", "acct-ent-1", "pending", 75000, "USD", new Date()]);
  await client.query("INSERT INTO order_line_items (order_id, product_name, quantity, unit_price_cents) VALUES ($1, $2, $3, $4)", ["ord-ent-1", "Enterprise License", 1, 75000]);
  await client.query("INSERT INTO invoices (invoice_id, account_id, order_id, invoice_number, amount_cents, total_cents, status, currency, issued_at, due_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)", ["inv-ent-1", "acct-ent-1", "ord-ent-1", "INV-001", 75000, 75000, "sent", "USD", new Date(), new Date()]);

  const summary = await getOrderSummary(client, "ord-ent-1");
  ok(summary, "regression: order summary returned");
  strictEqual(summary.orderId, "ord-ent-1", "regression: order ID matches");
  strictEqual(summary.accountName, "Enterprise Corp", "regression: account name in summary");

  // === NEW: preferredPaymentMethod ===
  const updated = await updateAccount(client, "acct-ent-1", { preferredPaymentMethod: "wire_transfer" });
  strictEqual(updated.preferredPaymentMethod, "wire_transfer", "new: account has preferredPaymentMethod");

  // Verify in live DB
  const liveAcct = (await client.query("SELECT * FROM accounts WHERE account_id = $1", ["acct-ent-1"])).rows[0];
  strictEqual(liveAcct.preferred_payment_method, "wire_transfer", "new: live DB has preferred_payment_method column");

  // Order summary must include preferredPaymentMethod
  const summaryWithPayment = await getOrderSummary(client, "ord-ent-1");
  strictEqual(summaryWithPayment.preferredPaymentMethod, "wire_transfer", "new: order summary includes preferredPaymentMethod");
});

console.log("Build-Bench enterprise acceptance passed: ${lane}");
`;
	}
	if (lane === "postgres-jsonb") {
		return `import { strictEqual, ok } from "node:assert";
import { withDb } from "../src/db.mjs";
import { ensureSchema } from "../src/schema.mjs";
import { createAccount, getAccount, updateAccount } from "../src/accounts.mjs";
import { getOrderSummary } from "../src/queries.mjs";

await withDb(async (client) => {
  await ensureSchema(client);

  // === REGRESSION ===
  const acct = await createAccount(client, { accountId: "acct-ent-1", name: "Enterprise Corp", tier: "strategic", status: "active" });
  ok(acct.accountId, "regression: account created");

  await client.query("INSERT INTO orders (order_id, account_id, doc) VALUES ($1, $2, $3)", ["ord-ent-1", "acct-ent-1", JSON.stringify({ orderId: "ord-ent-1", accountId: "acct-ent-1", status: "pending", totalCents: 75000, currency: "USD", createdAt: new Date().toISOString(), lineItems: [{ productName: "Enterprise License", quantity: 1, unitPriceCents: 75000 }] })]);
  await client.query("INSERT INTO invoices (invoice_id, account_id, doc) VALUES ($1, $2, $3)", ["inv-ent-1", "acct-ent-1", JSON.stringify({ invoiceId: "inv-ent-1", accountId: "acct-ent-1", orderId: "ord-ent-1", invoiceNumber: "INV-001", amountCents: 75000, totalCents: 75000, status: "sent", currency: "USD", issuedAt: new Date().toISOString(), dueAt: new Date().toISOString() })]);

  const summary = await getOrderSummary(client, "ord-ent-1");
  ok(summary, "regression: order summary returned");
  strictEqual(summary.orderId, "ord-ent-1", "regression: order ID matches");
  strictEqual(summary.accountName, "Enterprise Corp", "regression: account name in summary");

  // === NEW: preferredPaymentMethod ===
  const updated = await updateAccount(client, "acct-ent-1", { preferredPaymentMethod: "wire_transfer" });
  strictEqual(updated.preferredPaymentMethod, "wire_transfer", "new: account has preferredPaymentMethod");

  // Order summary must include preferredPaymentMethod
  const summaryWithPayment = await getOrderSummary(client, "ord-ent-1");
  strictEqual(summaryWithPayment.preferredPaymentMethod, "wire_transfer", "new: order summary includes preferredPaymentMethod");
});

console.log("Build-Bench enterprise acceptance passed: ${lane}");
`;
	}
	throw new Error(`No acceptance test for lane ${lane}`);
}

function rulesDoc() {
	return `# Build-Bench Enterprise — schema evolution on a 40-entity database

## Existing system

The database has a 40-entity enterprise schema (accounts, orders, products,
invoices, shipments, support cases, contracts, compliance, etc.) with working
CRUD code for accounts and an order summary query.

Read \`src/schema.mjs\` to understand the schema. Read \`src/accounts.mjs\` for
the account model. Read \`src/queries.mjs\` for the order summary query.

## Change request

1. Add a **preferredPaymentMethod** field (string, optional, enum: credit_card/wire_transfer/ach/paypal) to the **accounts** entity.
2. Update the **getOrderSummary** query in \`src/queries.mjs\` to include the account's preferredPaymentMethod in the result.

## Rules

- Do NOT break existing functionality — regression tests must pass.
- Connect to the real database via \`src/db.mjs\` (do NOT edit this file).
- Edit files under \`src/\` EXCEPT \`src/db.mjs\`. Do NOT modify anything under \`tests/\`.
- Do NOT add any file-based or in-memory fallback.
- Do NOT read skill files, run code reviews, or launch subagents. Just do the task directly.
- Do NOT read any files outside this workspace directory.
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
