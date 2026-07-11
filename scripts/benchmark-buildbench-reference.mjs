// Build-Bench reference solution for greenfield-CRUD / mongo / accounts.
// This is used ONLY by the contract proof (benchmark-prove-buildbench.mjs)
// to show the contract is satisfiable. The agent never sees this.
// It overwrites src/schema.mjs + src/accounts.mjs in a generated workspace
// with a working implementation, then runs npm test.

// Overwrite a workspace's stubs with this reference solution.
// Returns a map of relative-path -> file content.
export function referenceFiles() {
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
