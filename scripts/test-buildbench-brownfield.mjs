// Test: build-bench brownfield workspace generator — schema evolution task.
// Seam: writeBrownfieldWorkspace() produces a workspace with EXISTING schema +
// working code + a change request, where the agent must evolve the schema
// without breaking existing functionality.
import assert from "node:assert";
import { rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeBrownfieldWorkspace } from "./benchmark-workspace-brownfield.mjs";

const tmp = join(import.meta.dirname, "..", "benchmark", "_tmp-test-brownfield");
rmSync(tmp, { recursive: true, force: true });

writeBrownfieldWorkspace({
  workspace: tmp,
  lane: "mongo",
  taskType: "schema-evolution",
  ns: "buildbench_brownfield_test",
  dbHandle: { uri: "mongodb://127.0.0.1:27018", db: "buildbench_brownfield_test" },
});

// 1) protected files exist
for (const f of ["package.json", "db-config.json", "RULES.md", "README.md", "AGENTS.md"]) {
  assert(existsSync(join(tmp, f)), `missing ${f}`);
}

// 2) protected db.mjs (connection helper — agent must not edit)
assert(existsSync(join(tmp, "src", "db.mjs")), "missing src/db.mjs");

// 3) EXISTING working code (not stubs — the agent must READ and MODIFY these)
assert(existsSync(join(tmp, "src", "schema.mjs")), "missing src/schema.mjs");
assert(existsSync(join(tmp, "src", "accounts.mjs")), "missing src/accounts.mjs");

// 4) existing code must NOT be stubs (they should have working implementations, not throw)
const schemaSrc = readFileSync(join(tmp, "src", "schema.mjs"), "utf8");
assert(!/throw new Error/.test(schemaSrc), "schema.mjs must be working code, not a stub");
assert(/ensureSchema/.test(schemaSrc), "schema.mjs must export ensureSchema");

const accountsSrc = readFileSync(join(tmp, "src", "accounts.mjs"), "utf8");
assert(!/throw new Error/.test(accountsSrc), "accounts.mjs must be working code, not a stub");
assert(/createAccounts/.test(accountsSrc), "accounts.mjs must export createAccounts");
assert(/getAccounts/.test(accountsSrc), "accounts.mjs must export getAccounts");

// 5) acceptance test (protected — agent must not edit)
assert(existsSync(join(tmp, "tests", "acceptance.test.mjs")), "missing tests/acceptance.test.mjs");

// 6) the acceptance test must test BOTH old behavior (regression) AND new behavior
const testSrc = readFileSync(join(tmp, "tests", "acceptance.test.mjs"), "utf8");
assert(/regression/i.test(testSrc) || /existing/i.test(testSrc) || /old/i.test(testSrc), "test must check existing behavior (regression)");
assert(/riskScore|risk_score|newField|new_field/i.test(testSrc), "test must check the new field/feature");

// 7) the prompt must describe a CHANGE REQUEST, not "build from scratch"
const promptPath = join(tmp, "..", "prompt.md");
if (existsSync(promptPath)) {
  const prompt = readFileSync(promptPath, "utf8");
  assert(/existing/i.test(prompt), "prompt must mention existing schema/code");
  assert(/add|change|evolve|modify|update/i.test(prompt), "prompt must describe a change request");
}

// 8) package.json test script
const pkg = JSON.parse(readFileSync(join(tmp, "package.json"), "utf8"));
assert.strictEqual(pkg.scripts.test, "node tests/acceptance.test.mjs");

rmSync(tmp, { recursive: true, force: true });
console.log("build-bench brownfield workspace generator ok");
