// Build-Bench brownfield workspace generator.
// Produces a workspace with EXISTING working schema + code + a change request.
// The agent must evolve the schema without breaking existing functionality.
//
// Task type: schema-evolution
// Change request: add a "riskScore" field (0-100 integer) to the accounts entity.
//   - MongoDB: update the collection validator + update the model to set/return riskScore
//   - Postgres-norm: ALTER TABLE ADD COLUMN + update model to map the new column
//   - Postgres-jsonb: add to the JSONB doc + update model
// The acceptance test checks BOTH:
//   - Regression: existing CRUD still works (create/get/update/delete without riskScore)
//   - New: create with riskScore, get returns riskScore, update riskScore
import { mkdirSync, writeFileSync, symlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

export function writeBrownfieldWorkspace({ workspace, lane, taskType, ns, dbHandle }) {
  mkdirSync(join(workspace, "src"), { recursive: true });
  mkdirSync(join(workspace, "tests"), { recursive: true });

  writeFileSync(join(workspace, "package.json"), JSON.stringify({
    name: `build-bench-${lane}-${taskType}`,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: { test: "node tests/acceptance.test.mjs" },
  }, null, 2) + "\n");

  writeFileSync(join(workspace, "db-config.json"), JSON.stringify(dbConfig({ lane, ns, dbHandle }), null, 2) + "\n");
  writeFileSync(join(workspace, "RULES.md"), rulesDoc({ taskType }));
  writeFileSync(join(workspace, "README.md"), readmeDoc({ lane, taskType }));
  writeFileSync(join(workspace, "AGENTS.md"), agentsDoc({ lane }));

  // Protected: connection helper
  writeFileSync(join(workspace, "src", "db.mjs"), dbHelper(lane));

  // EXISTING working code (not stubs — the agent reads and modifies these)
  writeFileSync(join(workspace, "src", "schema.mjs"), existingSchema(lane));
  writeFileSync(join(workspace, "src", "accounts.mjs"), existingModel(lane));

  // Protected: acceptance test (regression + new behavior)
  writeFileSync(join(workspace, "tests", "acceptance.test.mjs"), acceptanceTest({ lane }));

  linkDrivers(workspace);
}

function dbConfig({ lane, ns, dbHandle }) {
  if (lane === "mongo") {
    return { uri: dbHandle.uri, db: dbHandle.db, namespace: ns };
  }
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

// EXISTING schema (working code — the agent must evolve this)
function existingSchema(lane) {
  if (lane === "mongo") {
    return `import { withDb } from "./db.mjs";

export async function ensureSchema(db) {
  const collections = await db.listCollections({ name: "accounts" }).toArray();
  if (collections.length === 0) {
    await db.createCollection("accounts", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["accountId", "name", "tier", "status", "createdAt"],
          properties: {
            accountId: { bsonType: "string" },
            name: { bsonType: "string" },
            tier: { enum: ["strategic", "midmarket", "standard"] },
            status: { enum: ["active", "at-risk", "churned"] },
            createdAt: { bsonType: "date" },
          },
        },
      },
    });
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
      account_id  TEXT        PRIMARY KEY,
      name        TEXT        NOT NULL,
      tier        TEXT        NOT NULL CHECK (tier IN ('strategic', 'midmarket', 'standard')),
      status      TEXT        NOT NULL CHECK (status IN ('active', 'at-risk', 'churned')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
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
      doc        JSONB NOT NULL,
      CONSTRAINT accounts_doc_key_match CHECK (doc->>'accountId' = account_id)
    )
  \`);
  await client.query('CREATE INDEX IF NOT EXISTS idx_accounts_doc_gin ON accounts USING GIN (doc jsonb_path_ops)');
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  withDb((client) => ensureSchema(client)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`;
  }
  throw new Error(`No existing schema for lane ${lane}`);
}

// EXISTING model (working CRUD — the agent must evolve this)
function existingModel(lane) {
  if (lane === "mongo") {
    return `import { ensureSchema } from "./schema.mjs";

export async function createAccounts(db, data) {
  await ensureSchema(db);
  const doc = { ...data, createdAt: data.createdAt || new Date() };
  const result = await db.collection("accounts").insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

export async function getAccounts(db, id) {
  return db.collection("accounts").findOne({ accountId: id });
}

export async function updateAccounts(db, id, data) {
  await db.collection("accounts").updateOne({ accountId: id }, { $set: data });
  return db.collection("accounts").findOne({ accountId: id });
}

export async function deleteAccounts(db, id) {
  const result = await db.collection("accounts").deleteOne({ accountId: id });
  return result.deletedCount > 0;
}
`;
  }
  if (lane === "postgres-norm") {
    return `import { ensureSchema } from "./schema.mjs";

function rowToAccount(r) {
  return { accountId: r.account_id, name: r.name, tier: r.tier, status: r.status, createdAt: r.created_at };
}

export async function createAccounts(client, data) {
  await ensureSchema(client);
  const result = await client.query(
    'INSERT INTO accounts (account_id, name, tier, status, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [data.accountId, data.name, data.tier, data.status, data.createdAt || new Date()]
  );
  return rowToAccount(result.rows[0]);
}

export async function getAccounts(client, id) {
  const res = await client.query('SELECT * FROM accounts WHERE account_id = $1', [id]);
  return res.rows[0] ? rowToAccount(res.rows[0]) : null;
}

export async function updateAccounts(client, id, data) {
  const sets = [];
  const vals = [];
  let i = 1;
  if (data.name !== undefined) { sets.push(\`name = $\${i++}\`); vals.push(data.name); }
  if (data.tier !== undefined) { sets.push(\`tier = $\${i++}\`); vals.push(data.tier); }
  if (data.status !== undefined) { sets.push(\`status = $\${i++}\`); vals.push(data.status); }
  if (sets.length === 0) return getAccounts(client, id);
  vals.push(id);
  await client.query(\`UPDATE accounts SET \${sets.join(', ')} WHERE account_id = $\${i}\`, vals);
  return getAccounts(client, id);
}

export async function deleteAccounts(client, id) {
  const res = await client.query('DELETE FROM accounts WHERE account_id = $1', [id]);
  return res.rowCount > 0;
}
`;
  }
  if (lane === "postgres-jsonb") {
    return `import { ensureSchema } from "./schema.mjs";

export async function createAccounts(client, data) {
  await ensureSchema(client);
  const doc = { ...data, createdAt: data.createdAt || new Date().toISOString() };
  await client.query('INSERT INTO accounts (account_id, doc) VALUES ($1, $2) RETURNING doc', [doc.accountId, JSON.stringify(doc)]);
  return doc;
}

export async function getAccounts(client, id) {
  const res = await client.query('SELECT doc FROM accounts WHERE account_id = $1', [id]);
  return res.rows[0]?.doc || null;
}

export async function updateAccounts(client, id, data) {
  const existing = await getAccounts(client, id);
  if (!existing) return null;
  const updated = { ...existing, ...data };
  await client.query('UPDATE accounts SET doc = $1 WHERE account_id = $2 RETURNING doc', [JSON.stringify(updated), id]);
  return updated;
}

export async function deleteAccounts(client, id) {
  const res = await client.query('DELETE FROM accounts WHERE account_id = $1', [id]);
  return res.rowCount > 0;
}
`;
  }
  throw new Error(`No existing model for lane ${lane}`);
}

// Acceptance test: regression (existing CRUD works) + new (riskScore field)
function acceptanceTest({ lane }) {
  if (lane === "mongo") {
    return `import { strictEqual, ok } from "node:assert";
import { withDb } from "../src/db.mjs";
import { ensureSchema } from "../src/schema.mjs";
import { createAccounts, getAccounts, updateAccounts, deleteAccounts } from "../src/accounts.mjs";

await withDb(async (db) => {
  await ensureSchema(db);

  // === REGRESSION: existing CRUD still works without riskScore ===
  const created = await createAccounts(db, {
    accountId: "acct-regression-1",
    name: "Regression Test Account",
    tier: "strategic",
    status: "active",
  });
  ok(created.accountId, "regression: create returns account with id");

  const read = await getAccounts(db, "acct-regression-1");
  ok(read, "regression: get returns the account");
  strictEqual(read.name, "Regression Test Account", "regression: name matches");

  const updated = await updateAccounts(db, "acct-regression-1", { name: "Updated Name" });
  strictEqual(updated.name, "Updated Name", "regression: update works");

  const deleted = await deleteAccounts(db, "acct-regression-1");
  ok(deleted, "regression: delete works");

  // === NEW: riskScore field (0-100 integer) ===
  const createdWithRisk = await createAccounts(db, {
    accountId: "acct-risk-1",
    name: "Risk Score Account",
    tier: "midmarket",
    status: "at-risk",
    riskScore: 75,
  });
  ok(createdWithRisk.riskScore !== undefined, "new: create with riskScore returns it");

  // verify riskScore is in the live DB
  const liveRow = await db.collection("accounts").findOne({ accountId: "acct-risk-1" });
  strictEqual(liveRow.riskScore, 75, "new: live DB has riskScore=75");

  // get returns riskScore
  const readWithRisk = await getAccounts(db, "acct-risk-1");
  strictEqual(readWithRisk.riskScore, 75, "new: get returns riskScore");

  // update riskScore
  const updatedRisk = await updateAccounts(db, "acct-risk-1", { riskScore: 90 });
  strictEqual(updatedRisk.riskScore, 90, "new: update riskScore works");

  // verify update hit the live DB
  const liveUpdated = await db.collection("accounts").findOne({ accountId: "acct-risk-1" });
  strictEqual(liveUpdated.riskScore, 90, "new: live DB reflects riskScore update");

  // cleanup
  await deleteAccounts(db, "acct-risk-1");
});

console.log("Build-Bench brownfield acceptance passed: ${lane}/schema-evolution");
`;
  }
  if (lane === "postgres-norm") {
    return `import { strictEqual, ok } from "node:assert";
import { withDb } from "../src/db.mjs";
import { ensureSchema } from "../src/schema.mjs";
import { createAccounts, getAccounts, updateAccounts, deleteAccounts } from "../src/accounts.mjs";

await withDb(async (client) => {
  await ensureSchema(client);

  // === REGRESSION: existing CRUD still works without riskScore ===
  const created = await createAccounts(client, {
    accountId: "acct-regression-1",
    name: "Regression Test Account",
    tier: "strategic",
    status: "active",
  });
  ok(created.accountId, "regression: create returns account with id");

  const read = await getAccounts(client, "acct-regression-1");
  ok(read, "regression: get returns the account");
  strictEqual(read.name, "Regression Test Account", "regression: name matches");

  const updated = await updateAccounts(client, "acct-regression-1", { name: "Updated Name" });
  strictEqual(updated.name, "Updated Name", "regression: update works");

  const deleted = await deleteAccounts(client, "acct-regression-1");
  ok(deleted, "regression: delete works");

  // === NEW: riskScore field (0-100 integer) ===
  const createdWithRisk = await createAccounts(client, {
    accountId: "acct-risk-1",
    name: "Risk Score Account",
    tier: "midmarket",
    status: "at-risk",
    riskScore: 75,
  });
  ok(createdWithRisk.riskScore !== undefined, "new: create with riskScore returns it");

  // verify riskScore is in the live DB (snake_case column)
  const liveRow = (await client.query('SELECT * FROM accounts WHERE account_id = $1', ["acct-risk-1"])).rows[0];
  strictEqual(liveRow.risk_score, 75, "new: live DB has risk_score=75");

  // get returns riskScore
  const readWithRisk = await getAccounts(client, "acct-risk-1");
  strictEqual(readWithRisk.riskScore, 75, "new: get returns riskScore");

  // update riskScore
  const updatedRisk = await updateAccounts(client, "acct-risk-1", { riskScore: 90 });
  strictEqual(updatedRisk.riskScore, 90, "new: update riskScore works");

  // verify update hit the live DB
  const liveUpdated = (await client.query('SELECT * FROM accounts WHERE account_id = $1', ["acct-risk-1"])).rows[0];
  strictEqual(liveUpdated.risk_score, 90, "new: live DB reflects riskScore update");

  // cleanup
  await deleteAccounts(client, "acct-risk-1");
});

console.log("Build-Bench brownfield acceptance passed: ${lane}/schema-evolution");
`;
  }
  if (lane === "postgres-jsonb") {
    return `import { strictEqual, ok } from "node:assert";
import { withDb } from "../src/db.mjs";
import { ensureSchema } from "../src/schema.mjs";
import { createAccounts, getAccounts, updateAccounts, deleteAccounts } from "../src/accounts.mjs";

await withDb(async (client) => {
  await ensureSchema(client);

  // === REGRESSION: existing CRUD still works without riskScore ===
  const created = await createAccounts(client, {
    accountId: "acct-regression-1",
    name: "Regression Test Account",
    tier: "strategic",
    status: "active",
  });
  ok(created.accountId, "regression: create returns account with id");

  const read = await getAccounts(client, "acct-regression-1");
  ok(read, "regression: get returns the account");
  strictEqual(read.name, "Regression Test Account", "regression: name matches");

  const updated = await updateAccounts(client, "acct-regression-1", { name: "Updated Name" });
  strictEqual(updated.name, "Updated Name", "regression: update works");

  const deleted = await deleteAccounts(client, "acct-regression-1");
  ok(deleted, "regression: delete works");

  // === NEW: riskScore field (0-100 integer) ===
  const createdWithRisk = await createAccounts(client, {
    accountId: "acct-risk-1",
    name: "Risk Score Account",
    tier: "midmarket",
    status: "at-risk",
    riskScore: 75,
  });
  ok(createdWithRisk.riskScore !== undefined, "new: create with riskScore returns it");

  // verify riskScore is in the live DB (inside JSONB doc)
  const liveRow = (await client.query('SELECT doc FROM accounts WHERE account_id = $1', ["acct-risk-1"])).rows[0];
  strictEqual(liveRow.doc.riskScore, 75, "new: live DB has riskScore=75 in doc");

  // get returns riskScore
  const readWithRisk = await getAccounts(client, "acct-risk-1");
  strictEqual(readWithRisk.riskScore, 75, "new: get returns riskScore");

  // update riskScore
  const updatedRisk = await updateAccounts(client, "acct-risk-1", { riskScore: 90 });
  strictEqual(updatedRisk.riskScore, 90, "new: update riskScore works");

  // verify update hit the live DB
  const liveUpdated = (await client.query('SELECT doc FROM accounts WHERE account_id = $1', ["acct-risk-1"])).rows[0];
  strictEqual(liveUpdated.doc.riskScore, 90, "new: live DB reflects riskScore update in doc");

  // cleanup
  await deleteAccounts(client, "acct-risk-1");
});

console.log("Build-Bench brownfield acceptance passed: ${lane}/schema-evolution");
`;
  }
  throw new Error(`No acceptance test for lane ${lane}`);
}

function rulesDoc({ taskType }) {
  return `# Build-Bench Brownfield — ${taskType}

## Existing system

The database has an existing **accounts** entity with working CRUD code.
The schema and model are in \`src/schema.mjs\` and \`src/accounts.mjs\`.
Read them before making changes.

## Change request

Add a **riskScore** field to the accounts entity:
- Type: integer, 0-100
- Required: no (existing accounts don't have it; new accounts may include it)
- Must be stored in the database (not just in application memory)

## Rules

- Do NOT break existing CRUD — the regression tests must still pass.
- Connect to the live database via \`src/db.mjs\` (do NOT edit this file).
- Update \`src/schema.mjs\` to include the new field in the schema/validator.
- Update \`src/accounts.mjs\` to handle the new field in create/get/update.
- All reads and writes MUST go to the live database — no mocks, no in-memory fallbacks.
- The acceptance test checks BOTH existing behavior (regression) AND the new field.
`;
}

function readmeDoc({ lane, taskType }) {
  return `# Build-Bench Brownfield — ${lane} / ${taskType}

The database has an existing accounts entity with working code.
Your task: add a **riskScore** field (0-100 integer) without breaking existing CRUD.

\`\`\`sh
npm test
\`\`\`

Edit \`src/schema.mjs\` and \`src/accounts.mjs\`. Do not edit \`src/db.mjs\` or anything under \`tests/\`.
`;
}

function agentsDoc({ lane }) {
  return `# Agent Guidelines — ${lane} (brownfield)

The database has EXISTING schema and code. Read \`src/schema.mjs\` and \`src/accounts.mjs\` first.
Your task is to ADD a riskScore field without breaking existing functionality.
Run \`npm test\` to verify — the test checks both old behavior (regression) and the new field.
Only edit files under \`src/\` except \`src/db.mjs\` (protected).
Do not edit anything under \`tests/\`.
`;
}

function linkDrivers(workspace) {
  const repoModules = join(import.meta.dirname, "..", "node_modules");
  if (existsSync(repoModules)) {
    try { symlinkSync(repoModules, join(workspace, "node_modules"), "dir"); } catch { /* already exists */ }
  }
}
