// Test: build-bench workspace generator for greenfield-CRUD (mongo pilot).
// Seam: writeBuildBenchWorkspace() produces a multi-file editable workspace
// with a stub the agent must implement + an acceptance test that verifies
// against the live DB.
import assert from "node:assert";
import { rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeBuildBenchWorkspace } from "./benchmark-workspace-buildbench.mjs";

const tmp = join(import.meta.dirname, "..", "benchmark", "_tmp-test-workspace");
rmSync(tmp, { recursive: true, force: true });

writeBuildBenchWorkspace({
	workspace: tmp,
	lane: "mongo",
	taskType: "greenfield-crud",
	resource: "accounts",
	ns: "buildbench_test",
	dbHandle: { uri: "mongodb://127.0.0.1:27018", db: "buildbench_test" },
});

// 1) protected files exist
for (const f of [
	"package.json",
	"db-config.json",
	"RULES.md",
	"README.md",
	"AGENTS.md",
]) {
	assert(existsSync(join(tmp, f)), `missing ${f}`);
}
// 2) protected db.mjs (connection helper — agent must not edit)
assert(existsSync(join(tmp, "src", "db.mjs")), "missing src/db.mjs");
// 3) editable stubs the agent must implement
assert(
	existsSync(join(tmp, "src", "schema.mjs")),
	"missing editable src/schema.mjs",
);
assert(
	existsSync(join(tmp, "src", "accounts.mjs")),
	"missing editable src/accounts.mjs",
);
// 4) acceptance test (protected — agent must not edit)
assert(
	existsSync(join(tmp, "tests", "acceptance.test.mjs")),
	"missing tests/acceptance.test.mjs",
);

// 5) stubs must throw (so the no-agent contract proof fails)
const schemaSrc = readFileSync(join(tmp, "src", "schema.mjs"), "utf8");
assert(/throw new Error/.test(schemaSrc), "schema stub must throw");
const accountsSrc = readFileSync(join(tmp, "src", "accounts.mjs"), "utf8");
assert(/throw new Error/.test(accountsSrc), "accounts stub must throw");

// 6) acceptance test must call handlers AND query live DB directly
const testSrc = readFileSync(join(tmp, "tests", "acceptance.test.mjs"), "utf8");
assert(/createAccount/.test(testSrc), "test calls createAccount");
assert(/getAccount/.test(testSrc), "test calls getAccount");
assert(/updateAccount/.test(testSrc), "test calls updateAccount");
assert(/deleteAccount/.test(testSrc), "test calls deleteAccount");
assert(
	/withDb/.test(testSrc),
	"test queries live DB directly (not just handler response)",
);

// 7) package.json test script points at acceptance test
const pkg = JSON.parse(readFileSync(join(tmp, "package.json"), "utf8"));
assert.strictEqual(pkg.scripts.test, "node tests/acceptance.test.mjs");

// 8) db-config.json has the right uri + db
const cfg = JSON.parse(readFileSync(join(tmp, "db-config.json"), "utf8"));
assert.strictEqual(cfg.uri, "mongodb://127.0.0.1:27018");
assert.strictEqual(cfg.db, "buildbench_test");

rmSync(tmp, { recursive: true, force: true });
console.log("build-bench workspace generator ok");
