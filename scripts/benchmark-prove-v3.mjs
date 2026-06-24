// Proves the V3 live-DB contract WITHOUT any agent:
//  for each lane x scenario: seed live DB -> generate workspace ->
//    (a) stub `npm test` FAILS  -> contract is non-trivial
//    (b) reference solution `npm test` PASSES -> contract is satisfiable
//  Negative controls additionally prove copying the escalation answer FAILS.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ALL_SCENARIOS, PRIMARY_SCENARIO, NEGATIVE_CONTROLS, deriveExpected } from "./benchmark-derive.mjs";
import { seed, teardown, namespace, LANES } from "./benchmark-livedb.mjs";
import { writeV3Workspace } from "./benchmark-workspace-v3.mjs";
import { referenceWorkflow } from "./benchmark-reference-solutions.mjs";

const ROOT = "benchmark/.prove-v3";
const shape = process.argv.includes("--shape") ? process.argv[process.argv.indexOf("--shape") + 1] : "moderate";
rmSync(ROOT, { recursive: true, force: true });

let pass = 0, fail = 0;
const fails = [];

for (const lane of LANES) {
  for (const scenario of ALL_SCENARIOS) {
    const ns = namespace({ shape, lane, agentId: `prove_${scenario.id}`, repeat: 1 });
    const ws = join(ROOT, lane, scenario.id);
    const expected = deriveExpected(scenario);
    try {
      const dbHandle = seed({ world: scenario, shape, lane, ns });
      writeV3Workspace({ workspace: ws, lane, shape, ns, dbHandle, scenarioId: scenario.id });

      // (a) stub must FAIL
      const stub = npmTest(ws);
      const stubFailed = stub.status !== 0;

      // (b) reference must PASS
      writeFileSync(join(ws, "src", "workflow.mjs"), referenceWorkflow(lane));
      const ref = npmTest(ws);
      const refPassed = ref.status === 0;

      const ok = stubFailed && refPassed;
      const tag = scenario === PRIMARY_SCENARIO ? "PRIMARY" : "neg-ctrl";
      if (ok) { pass++; console.log(`✓ [${lane}] ${scenario.id} (${tag}) — stub fails, reference passes (qualifies=${expected.qualifies})`); }
      else { fail++; fails.push(`${lane}/${scenario.id}`); console.log(`✗ [${lane}] ${scenario.id} — stubFailed=${stubFailed} refPassed=${refPassed}\n${(!refPassed ? ref.stdout + ref.stderr : "").slice(-600)}`); }
    } catch (e) {
      fail++; fails.push(`${lane}/${scenario.id}`);
      console.log(`✗ [${lane}] ${scenario.id} — harness error: ${e.message}`);
    } finally {
      teardown({ lane, ns });
    }
  }
}

console.log(`\nV3 proof: ${pass} passed, ${fail} failed.` + (fails.length ? ` Failures: ${fails.join(", ")}` : ""));
process.exit(fail ? 1 : 0);

function npmTest(ws) {
  return spawnSync("npm", ["test"], { cwd: ws, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}
