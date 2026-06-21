#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const verifiedPath = "prototypes/lab-console/replays/order-exception-codex-v1-verified.json";
const artifact = JSON.parse(readFileSync(verifiedPath, "utf8"));

mkdirSync(".tmp", { recursive: true });

assertRejected("required-proof-item", (mutant) => {
  mutant.proofPacket.items[0].value = "Required";
});

assertRejected("runtime-data-enabled", (mutant) => {
  mutant.dataContract.mockDataAllowed = true;
});

console.log("Negative proof gate tests passed");

function assertRejected(name, mutate) {
  const mutant = structuredClone(artifact);
  mutate(mutant);
  const tmpPath = `.tmp/verified-negative-${name}.json`;
  writeFileSync(tmpPath, `${JSON.stringify(mutant, null, 2)}\n`);

  const validator = spawnSync(process.execPath, ["prototypes/lab-console/validate-replay-artifact.mjs", tmpPath], { encoding: "utf8" });
  const gates = spawnSync(process.execPath, ["scripts/check-proof-gates.mjs", tmpPath], { encoding: "utf8" });

  if (validator.status === 0) {
    process.stdout.write(validator.stdout || "");
    process.stderr.write(validator.stderr || "");
    throw new Error(`Negative validator test failed: ${name} was accepted`);
  }

  if (gates.status === 0) {
    process.stdout.write(gates.stdout || "");
    process.stderr.write(gates.stderr || "");
    throw new Error(`Negative gate test failed: ${name} was accepted`);
  }
}
