// Build-Bench reference solutions for greenfield-CRUD / accounts.
// Used ONLY by the contract proof (benchmark-prove-buildbench.mjs)
// to show the contract is satisfiable. The agent never sees this.
//
// Postgres lanes adapted from the EEO (Equal-Effort Opponent) expert design,
// with function signatures adjusted to match the acceptance test contract
// (createAccounts(client, data) for a single object, getAccounts(client, id)
// for a single-id lookup). The EEO improvements preserved: named CHECK
// constraints, status btree index, jsonb_path_ops GIN index, key-match
// constraint, TIMESTAMPTZ.

// Returns a map of relative-path -> file content for the given lane.
export function referenceFiles(lane) {
	if (lane === "mongo") return mongoReference();
	if (lane === "postgres-norm") return pgNormReference();
	if (lane === "postgres-jsonb") return pgJsonbReference();
	throw new Error(`No reference for lane ${lane}`);
}

function mongoReference() {
	return {
		"src/schema.mjs": `import { withDb } from "./db.mjs";

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
  await db.collection("accounts").createIndex({ accountId: 1 }, { unique: true });
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  withDb((db) => ensureSchema(db)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`,
		"src/accounts.mjs": `import { ensureSchema } from "./schema.mjs";

export async function createAccounts(db, data) {
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
`,
	};
}

function pgNormReference() {
	// EEO-adapted: named CHECK constraints, status btree index, TIMESTAMPTZ.
	// Signature adjusted to match acceptance test: createAccounts(client, data) single object.
	return {
		"src/schema.mjs": `import { withDb } from "./db.mjs";

export async function ensureSchema(client) {
  await client.query(\`
    CREATE TABLE IF NOT EXISTS accounts (
      account_id  TEXT        PRIMARY KEY,
      name        TEXT        NOT NULL,
      tier        TEXT        NOT NULL,
      status      TEXT        NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL,
      CONSTRAINT accounts_tier_check
        CHECK (tier IN ('strategic', 'midmarket', 'standard')),
      CONSTRAINT accounts_status_check
        CHECK (status IN ('active', 'at-risk', 'churned'))
    )
  \`);
  await client.query('CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts (status)');
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  withDb((client) => ensureSchema(client)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`,
		"src/accounts.mjs": `import { ensureSchema } from "./schema.mjs";

export async function createAccounts(client, data) {
  const row = {
    account_id: data.accountId,
    name: data.name,
    tier: data.tier,
    status: data.status,
    created_at: data.createdAt || new Date(),
  };
  const result = await client.query(
    'INSERT INTO accounts (account_id, name, tier, status, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [row.account_id, row.name, row.tier, row.status, row.created_at]
  );
  const r = result.rows[0];
  return { accountId: r.account_id, name: r.name, tier: r.tier, status: r.status, createdAt: r.created_at };
}

export async function getAccounts(client, id) {
  const res = await client.query('SELECT * FROM accounts WHERE account_id = $1', [id]);
  if (!res.rows[0]) return null;
  const r = res.rows[0];
  return { accountId: r.account_id, name: r.name, tier: r.tier, status: r.status, createdAt: r.created_at };
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
`,
	};
}

function pgJsonbReference() {
	// EEO-adapted: jsonb_path_ops GIN index, key-match CHECK, required-key CHECKs,
	// enum CHECKs inside JSONB. Signature adjusted to match acceptance test.
	return {
		"src/schema.mjs": `import { withDb } from "./db.mjs";

export async function ensureSchema(client) {
  await client.query(\`
    CREATE TABLE IF NOT EXISTS accounts (
      account_id TEXT   PRIMARY KEY,
      doc        JSONB  NOT NULL,
      CONSTRAINT accounts_doc_key_match
        CHECK (doc->>'accountId' = account_id),
      CONSTRAINT accounts_doc_has_name
        CHECK (doc ? 'name' AND (doc->>'name') IS NOT NULL),
      CONSTRAINT accounts_doc_has_tier
        CHECK (doc ? 'tier' AND (doc->>'tier') IS NOT NULL),
      CONSTRAINT accounts_doc_has_status
        CHECK (doc ? 'status' AND (doc->>'status') IS NOT NULL),
      CONSTRAINT accounts_doc_has_created_at
        CHECK (doc ? 'createdAt' AND (doc->>'createdAt') IS NOT NULL),
      CONSTRAINT accounts_doc_tier_check
        CHECK (doc->>'tier' IN ('strategic', 'midmarket', 'standard')),
      CONSTRAINT accounts_doc_status_check
        CHECK (doc->>'status' IN ('active', 'at-risk', 'churned'))
    )
  \`);
  await client.query('CREATE INDEX IF NOT EXISTS idx_accounts_doc_gin ON accounts USING GIN (doc jsonb_path_ops)');
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  withDb((client) => ensureSchema(client)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`,
		"src/accounts.mjs": `import { ensureSchema } from "./schema.mjs";

export async function createAccounts(client, data) {
  const doc = { ...data, createdAt: data.createdAt || new Date().toISOString() };
  await client.query(
    'INSERT INTO accounts (account_id, doc) VALUES ($1, $2) RETURNING doc',
    [doc.accountId, JSON.stringify(doc)]
  );
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
`,
	};
}
