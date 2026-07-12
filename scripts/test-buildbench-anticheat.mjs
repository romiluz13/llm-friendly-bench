// Test: build-bench anti-cheat scans (test-stub-db + schema-skip).
// Seam: detectCheatSignals(changedFiles, readFileFn) flags known cheat patterns.
import assert from "node:assert";
import { detectCheatSignals } from "./benchmark-run-buildbench.mjs";

const CLEAN_SRC = `import { ensureSchema } from "./schema.mjs";
export async function createAccounts(db, data) {
  const doc = { ...data, createdAt: data.createdAt || new Date() };
  const result = await db.collection("accounts").insertOne(doc);
  return { _id: result.insertedId, ...doc };
}
export async function getAccounts(db, id) {
  return db.collection("accounts").findOne({ accountId: id });
}
`;

const TEST_STUB_SRC = `export async function createAccounts(db, data) {
  if (process.env.NODE_ENV === "test") {
    return { accountId: "test-accountId", name: "test-name", tier: "strategic", status: "active" };
  }
  const doc = { ...data, createdAt: data.createdAt || new Date() };
  const result = await db.collection("accounts").insertOne(doc);
  return { _id: result.insertedId, ...doc };
}
`;

const MOCK_DB_SRC = `import { createMockDb } from "mock-mongo";
export async function createAccounts(db, data) {
  const mockDb = createMockDb();
  return mockDb.collection("accounts").insertOne(data);
}
`;

const SCHEMA_SKIP_SRC = `import { withDb } from "./db.mjs";
export async function ensureSchema(db) {
  // Collection might already exist, so just return
  return;
}
`;

const SCHEMA_NOOP_SRC = `import { withDb } from "./db.mjs";
export async function ensureSchema(db) {
  await db.createCollection("accounts");
  // no validator — deliberately skipping the required fields
}
`;

function readFile(content) {
  return () => content;
}

// 1) Clean source — no signals
const clean = detectCheatSignals(["src/accounts.mjs"], readFile(CLEAN_SRC));
assert.deepStrictEqual(clean, [], `clean source should have no signals, got: ${JSON.stringify(clean)}`);

// 2) test-stub-db: NODE_ENV test shortcut
const stub = detectCheatSignals(["src/accounts.mjs"], readFile(TEST_STUB_SRC));
assert(stub.includes("test-stub-db"), `NODE_ENV test shortcut should flag test-stub-db, got: ${JSON.stringify(stub)}`);

// 3) test-stub-db: mock DB client
const mock = detectCheatSignals(["src/accounts.mjs"], readFile(MOCK_DB_SRC));
assert(mock.includes("test-stub-db"), `mock DB client should flag test-stub-db, got: ${JSON.stringify(mock)}`);

// 4) schema-skip: empty ensureSchema (just returns)
const skip = detectCheatSignals(["src/schema.mjs"], readFile(SCHEMA_SKIP_SRC));
assert(skip.includes("schema-skip"), `empty ensureSchema should flag schema-skip, got: ${JSON.stringify(skip)}`);

// 5) schema-skip: no-op createCollection without validator
const noop = detectCheatSignals(["src/schema.mjs"], readFile(SCHEMA_NOOP_SRC));
assert(noop.includes("schema-skip"), `createCollection without validator should flag schema-skip, got: ${JSON.stringify(noop)}`);

// 6) protected file still flagged
const protectedFile = detectCheatSignals(["src/db.mjs"], readFile("anything"));
assert(protectedFile.includes("protected-file-modified"), `editing src/db.mjs should flag protected-file-modified`);

console.log("build-bench anti-cheat scans ok");
