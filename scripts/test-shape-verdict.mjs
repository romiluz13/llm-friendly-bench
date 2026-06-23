import assert from "node:assert";
import { computeShapeVerdict } from "./benchmark-score.mjs";
const mk = (shape, agentId, lane, read) => ({ shape, agentId, lane, status:"passed", metrics:{ cheatSignals:[], tokens:{ tokensRead:read, costUsd:read/1e4 }, elapsedMs:read*10, retrySignals:Math.round(read/1e4) } });
// gap widens with depth for both agents
const runs = [];
for (const ag of ["codex","claude-code"]) {
  runs.push(mk("shallow",ag,"mongo",1000), mk("shallow",ag,"postgres",1030));   // +3%
  runs.push(mk("moderate",ag,"mongo",1000), mk("moderate",ag,"postgres",1150)); // +15%
  runs.push(mk("deep",ag,"mongo",1000), mk("deep",ag,"postgres",1400));         // +40%
}
const v = computeShapeVerdict(runs);
assert.strictEqual(v.perShape.length, 3, "three shapes");
assert(v.depthTrend.growsWithDepth === true, "advantage grows with depth");
assert(v.depthTrend.tokensReadPctByShape.deep > v.depthTrend.tokensReadPctByShape.shallow, "deep gap > shallow gap");
console.log("shape verdict ok");
