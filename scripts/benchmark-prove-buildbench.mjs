// Build-Bench contract proof: for greenfield-CRUD/mongo/accounts,
// the stub solution fails npm test (contract non-trivial) and the reference
// solution passes (contract satisfiable).
// No agent involved — this is the no-agent gate reused from v3's pattern.
import { rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { writeBuildBenchWorkspace } from "./benchmark-workspace-buildbench.mjs";
import { referenceFiles } from "./benchmark-buildbench-reference.mjs";
import { execSync } from "node:child_process";

const TMP = join(import.meta.dirname, "..", "benchmark", "_tmp-prove-buildbench");
const NS = "buildbench_prove";

function dropNs() {
  try {
    execSync(`mongosh --quiet mongodb://127.0.0.1:27018/${NS} --eval 'db.dropDatabase()'`, { stdio: "pipe" });
  } catch { /* ignore — ns may not exist */ }
}

function runTest(workspace) {
  return spawnSync("npm", ["test"], { cwd: workspace, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}

function proveOne({ label, setup }) {
  const workspace = join(TMP, label);
  rmSync(workspace, { recursive: true, force: true });
  dropNs();

  writeBuildBenchWorkspace({
    workspace,
    lane: "mongo",
    taskType: "greenfield-crud",
    resource: "accounts",
    ns: NS,
    dbHandle: { uri: "mongodb://127.0.0.1:27018", db: NS },
  });

  // Apply setup (overwrite stubs with reference, or leave stubs as-is)
  if (setup) {
    const files = setup();
    for (const [rel, content] of Object.entries(files)) {
      writeFileSync(join(workspace, rel), content);
    }
  }

  dropNs(); // fresh namespace before the test runs
  const result = runTest(workspace);
  const passed = result.status === 0;
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  return { label, passed, output };
}

// 1) STUB must fail (contract is non-trivial)
const stub = proveOne({ label: "stub" });
if (stub.passed) {
  console.error(`✗ FAIL: stub passed — contract is trivial (too easy)`);
  console.error(stub.output.slice(-500));
  process.exit(1);
}
console.log(`✓ [stub] fails npm test (contract non-trivial)`);

// 2) REFERENCE must pass (contract is satisfiable)
const ref = proveOne({ label: "reference", setup: referenceFiles });
if (!ref.passed) {
  console.error(`✗ FAIL: reference failed — contract is unsatisfiable (too hard)`);
  console.error(ref.output.slice(-1000));
  process.exit(1);
}
console.log(`✓ [reference] passes npm test (contract satisfiable)`);

// 3) CLEANUP
dropNs();
rmSync(TMP, { recursive: true, force: true });

console.log(`\nBuild-Bench proof: greenfield-CRUD/mongo/accounts — stub fails, reference passes. Contract is good.`);
