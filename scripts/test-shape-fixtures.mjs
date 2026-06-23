import assert from "node:assert";
import { buildTaskFixture } from "./benchmark-lib.mjs";
import { shapeMeta } from "./benchmark-shapes.mjs";
const task = { id: "t", title: "T", primaryEntity: "account", domainId: "d", domainLabel: "D", taskIndex: 0, businessPrompt: "p", expectedOutcome: "o" };

// Mongo identical across shapes (document stays flat)
const m1 = JSON.stringify(buildTaskFixture(task, "mongo", "shallow"));
const m2 = JSON.stringify(buildTaskFixture(task, "mongo", "deep"));
assert.strictEqual(m1, m2, "mongo fixture is shape-independent");

// Postgres table count grows with depth
for (const s of ["shallow","moderate","deep"]) {
  const pg = buildTaskFixture(task, "postgres", s);
  const tableCount = Object.keys(pg).length;
  assert.strictEqual(tableCount, shapeMeta(s).postgresTableCount, `${s} postgres has ${shapeMeta(s).postgresTableCount} tables, got ${tableCount}`);
}
// Deep must include a many-to-many junction table (heavy join signal)
const deep = buildTaskFixture(task, "postgres", "deep");
assert(Object.keys(deep).some((t) => /_x_|_link|_membership|junction/.test(t)), "deep has a junction table");
console.log("shape fixtures ok");
