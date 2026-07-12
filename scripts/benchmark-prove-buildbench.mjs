// Build-Bench contract proof: for greenfield-CRUD/accounts across all lanes,
// the stub solution fails npm test (contract non-trivial) and the reference
// solution passes (contract satisfiable).
// No agent involved — this is the no-agent gate reused from v3's pattern.
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync, execSync } from "node:child_process";
import { writeBuildBenchWorkspace } from "./benchmark-workspace-buildbench.mjs";
import { referenceFiles } from "./benchmark-buildbench-reference.mjs";

const TMP = join(
	import.meta.dirname,
	"..",
	"benchmark",
	"_tmp-prove-buildbench",
);
const LANES = ["mongo", "postgres-norm", "postgres-jsonb"];

function dropNs(lane, ns) {
	if (lane === "mongo") {
		try {
			execSync(
				`mongosh --quiet mongodb://127.0.0.1:27018/${ns} --eval 'db.dropDatabase()'`,
				{ stdio: "pipe" },
			);
		} catch {
			/* ignore */
		}
	} else {
		try {
			execSync(
				`docker exec sql-hidden-cost-postgres psql -U lab -d sql_hidden_cost -c 'DROP SCHEMA IF EXISTS "${ns}" CASCADE; CREATE SCHEMA "${ns}";'`,
				{ stdio: "pipe" },
			);
		} catch {
			/* ignore */
		}
	}
}

function dbHandleFor(lane, ns) {
	if (lane === "mongo") return { uri: "mongodb://127.0.0.1:27018", db: ns };
	return {
		host: "127.0.0.1",
		port: 5433,
		user: "lab",
		password: "lab",
		database: "sql_hidden_cost",
		schema: ns,
	};
}

function runTest(workspace) {
	return spawnSync("npm", ["test"], {
		cwd: workspace,
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
	});
}

function proveOne({ lane, label, setup }) {
	const ns = `buildbench_prove_${lane}`;
	const workspace = join(TMP, lane, label);
	rmSync(workspace, { recursive: true, force: true });
	dropNs(lane, ns);

	writeBuildBenchWorkspace({
		workspace,
		lane,
		taskType: "greenfield-crud",
		resource: "accounts",
		ns,
		dbHandle: dbHandleFor(lane, ns),
	});

	if (setup) {
		const files = setup(lane);
		for (const [rel, content] of Object.entries(files)) {
			writeFileSync(join(workspace, rel), content);
		}
	}

	dropNs(lane, ns); // fresh namespace before the test runs
	const result = runTest(workspace);
	const passed = result.status === 0;
	const output = `${result.stdout || ""}${result.stderr || ""}`;
	return { lane, label, passed, output };
}

let failures = 0;

for (const lane of LANES) {
	// 1) STUB must fail (contract is non-trivial)
	const stub = proveOne({ lane, label: "stub" });
	if (stub.passed) {
		console.error(
			`✗ FAIL [${lane}/stub]: passed — contract is trivial (too easy)`,
		);
		console.error(stub.output.slice(-500));
		failures++;
	} else {
		console.log(`✓ [${lane}/stub] fails npm test (contract non-trivial)`);
	}

	// 2) REFERENCE must pass (contract is satisfiable)
	const ref = proveOne({ lane, label: "reference", setup: referenceFiles });
	if (!ref.passed) {
		console.error(
			`✗ FAIL [${lane}/reference]: failed — contract is unsatisfiable (too hard)`,
		);
		console.error(ref.output.slice(-1000));
		failures++;
	} else {
		console.log(`✓ [${lane}/reference] passes npm test (contract satisfiable)`);
	}

	// 3) CLEANUP
	dropNs(lane, `buildbench_prove_${lane}`);
}

rmSync(TMP, { recursive: true, force: true });

if (failures > 0) {
	console.error(`\nBuild-Bench proof: ${failures} failure(s).`);
	process.exit(1);
}
console.log(
	`\nBuild-Bench proof: ${LANES.length} lanes — stub fails, reference passes. Contract is good.`,
);
