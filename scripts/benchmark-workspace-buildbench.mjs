// Build-Bench workspace generator.
// Produces a multi-file editable workspace for a build task.
// The agent edits src/ (schema, model/handlers); tests/ and src/db.mjs are protected.
import { mkdirSync, writeFileSync, symlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const PRIMARY_RESOURCE = {
  name: "accounts",
  fields: [
    { key: "accountId", type: "string", required: true },
    { key: "name", type: "string", required: true },
    { key: "tier", type: "string", required: true, enum: ["strategic", "midmarket", "standard"] },
    { key: "status", type: "string", required: true, enum: ["active", "at-risk", "churned"] },
    { key: "createdAt", type: "date", required: true },
  ],
};

export function writeBuildBenchWorkspace({ workspace, lane, taskType, resource, ns, dbHandle }) {
  const res = typeof resource === "string" ? PRIMARY_RESOURCE : (resource || PRIMARY_RESOURCE);
  mkdirSync(join(workspace, "src"), { recursive: true });
  mkdirSync(join(workspace, "tests"), { recursive: true });

  writeFileSync(join(workspace, "package.json"), JSON.stringify({
    name: `build-bench-${lane}-${taskType}`,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: { test: "node tests/acceptance.test.mjs" },
  }, null, 2) + "\n");

  writeFileSync(join(workspace, "db-config.json"), JSON.stringify({
    uri: dbHandle.uri,
    db: dbHandle.db,
    namespace: ns,
  }, null, 2) + "\n");

  writeFileSync(join(workspace, "RULES.md"), rulesDoc({ taskType, res }));
  writeFileSync(join(workspace, "README.md"), readmeDoc({ lane, taskType, res }));
  writeFileSync(join(workspace, "AGENTS.md"), agentsDoc({ lane }));

  // Protected: connection helper (agent must not edit)
  writeFileSync(join(workspace, "src", "db.mjs"), dbHelper(lane));

  // Editable stubs the agent must implement
  writeFileSync(join(workspace, "src", "schema.mjs"), schemaStub({ lane, res }));
  writeFileSync(join(workspace, "src", `${res.name}.mjs`), modelStub({ res }));

  // Protected: acceptance test (agent must not edit)
  writeFileSync(join(workspace, "tests", "acceptance.test.mjs"), acceptanceTest({ lane, res }));

  linkDrivers(workspace);
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
  throw new Error(`No dbHelper for lane ${lane} yet`);
}

function schemaStub({ lane, res }) {
  if (lane === "mongo") {
    return `// Create the ${res.name} collection with a validator.
// Export an async function ensureSchema(db) that creates the collection
// with a JSON schema validator matching the ${res.name} fields.
//
// Fields:
${res.fields.map((f) => `//   ${f.key}: ${f.type}${f.required ? " (required)" : ""}${f.enum ? ` — one of ${JSON.stringify(f.enum)}` : ""}`).join("\n")}
import { withDb } from "./db.mjs";

export async function ensureSchema(db) {
  // TODO: create the ${res.name} collection with a validator.
  throw new Error("schema not implemented");
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  withDb((db) => ensureSchema(db)).then(() => console.log("schema ready")).catch((e) => { console.error(e); process.exit(1); });
}
`;
  }
  throw new Error(`No schema stub for lane ${lane} yet`);
}

function modelStub({ res }) {
  return `// Implement CRUD for the ${res.name} resource against the live DB.
// Each function receives the db handle from src/db.mjs.
// Call ensureSchema(db) from src/schema.mjs before the first write.
import { ensureSchema } from "./schema.mjs";

// Create a ${res.name} record. Return the created document.
export async function create${cap(res.name)}(db, data) {
  throw new Error("create${cap(res.name)} not implemented");
}

// Read a ${res.name} by its id. Return the document or null.
export async function get${cap(res.name)}(db, id) {
  throw new Error("get${cap(res.name)} not implemented");
}

// Update a ${res.name} by id with partial data. Return the updated document.
export async function update${cap(res.name)}(db, id, data) {
  throw new Error("update${cap(res.name)} not implemented");
}

// Delete a ${res.name} by id. Return true if deleted.
export async function delete${cap(res.name)}(db, id) {
  throw new Error("delete${cap(res.name)} not implemented");
}
`;
}

function testValue(f) {
  if (f.enum) return JSON.stringify(f.enum[0]);
  if (f.type === "date") return 'new Date("2026-07-11T12:00:00.000Z")';
  if (f.type === "string") return JSON.stringify(`test-${f.key}`);
  return "1";
}

function acceptanceTest({ lane, res }) {
  if (lane === "mongo") {
    return `import { strictEqual, deepStrictEqual, ok } from "node:assert";
import { withDb } from "../src/db.mjs";
import { ensureSchema } from "../src/schema.mjs";
import { create${cap(res.name)}, get${cap(res.name)}, update${cap(res.name)}, delete${cap(res.name)} } from "../src/${res.name}.mjs";

const now = new Date("2026-07-11T12:00:00.000Z");

await withDb(async (db) => {
  // 1) ensure schema exists
  await ensureSchema(db);

  // 2) create
  const created = await create${cap(res.name)}(db, {
    ${res.fields.filter((f) => f.key !== "createdAt").map((f) => `${f.key}: ${testValue(f)}`).join(", ")},
  });
  ok(created._id || created.${res.fields[0].key}, "create returns a document with an id");

  // 3) verify the row exists in the live DB directly (not just the handler response)
  const liveRow = await db.collection("${res.name}").findOne({ ${res.fields[0].key}: created.${res.fields[0].key} });
  ok(liveRow, "live DB has the created row");
  strictEqual(liveRow.${res.fields[1].key}, created.${res.fields[1].key}, "live DB row matches handler response");

  // 4) read via handler
  const read = await get${cap(res.name)}(db, created.${res.fields[0].key});
  ok(read, "get returns the document");
  strictEqual(read.${res.fields[1].key}, created.${res.fields[1].key}, "read matches created");

  // 5) update
  const updated = await update${cap(res.name)}(db, created.${res.fields[0].key}, { ${res.fields[1].key}: "updated-name" });
  strictEqual(updated.${res.fields[1].key}, "updated-name", "update returns updated doc");

  // 6) verify update hit the live DB
  const liveUpdated = await db.collection("${res.name}").findOne({ ${res.fields[0].key}: created.${res.fields[0].key} });
  strictEqual(liveUpdated.${res.fields[1].key}, "updated-name", "live DB reflects the update");

  // 7) delete
  const deleted = await delete${cap(res.name)}(db, created.${res.fields[0].key});
  ok(deleted, "delete returns true");

  // 8) verify delete hit the live DB
  const liveDeleted = await db.collection("${res.name}").findOne({ ${res.fields[0].key}: created.${res.fields[0].key} });
  ok(!liveDeleted, "live DB no longer has the row");
});

console.log("Build-Bench acceptance passed: ${lane}/${res.name} CRUD");
`;
  }
  throw new Error(`No acceptance test for lane ${lane} yet`);
}

function rulesDoc({ taskType, res }) {
  return `# Build-Bench Rules — ${taskType}

## Task

Design the schema for the **${res.name}** resource and implement CRUD
(create, read, update, delete) against the live database.

## Fields

${res.fields.map((f) => `- **${f.key}** (${f.type})${f.required ? " — required" : ""}${f.enum ? ` — must be one of ${JSON.stringify(f.enum)}` : ""}`).join("\n")}

## Rules

- Connect to the live database via \`src/db.mjs\` (do NOT edit this file).
- Create the collection/schema in \`src/schema.mjs\` via \`ensureSchema(db)\`.
- Implement CRUD in \`src/${res.name}.mjs\`.
- All reads and writes MUST go to the live database — no mocks, no in-memory fallbacks.
- The acceptance test calls your handlers AND queries the live DB directly to verify.
`;
}

function readmeDoc({ lane, taskType, res }) {
  return `# Build-Bench — ${lane} / ${taskType}

Build a CRUD resource (**${res.name}**) against the live ${lane} database.

\`\`\`sh
npm test
\`\`\`

Edit \`src/schema.mjs\` and \`src/${res.name}.mjs\`. Do not edit \`src/db.mjs\` or anything under \`tests/\`.
`;
}

function agentsDoc({ lane }) {
  return `# Agent Guidelines — ${lane}

Build the schema and CRUD handlers. Run \`npm test\` to verify.
Only edit files under \`src/\` except \`src/db.mjs\` (protected).
Do not edit anything under \`tests/\`.
`;
}

function linkDrivers(workspace) {
  const target = join(workspace, "..", "..", "..", "node_modules");
  if (existsSync(target)) {
    try { symlinkSync(target, join(workspace, "node_modules"), "dir"); } catch { /* already exists */ }
  }
  // Also link from repo root if the relative didn't resolve
  const repoModules = join(import.meta.dirname, "..", "node_modules");
  if (existsSync(repoModules) && !existsSync(join(workspace, "node_modules"))) {
    try { symlinkSync(repoModules, join(workspace, "node_modules"), "dir"); } catch { /* already exists */ }
  }
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
