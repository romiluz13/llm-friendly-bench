import assert from "node:assert";
import { computeDatabaseVerdict } from "./benchmark-score.mjs";
const runs = [
  { agentId:"claude-code", lane:"mongo", status:"passed", metrics:{ tokens:{totalTokens:1000,costUsd:0.10}, elapsedMs:60000, retrySignals:2 } },
  { agentId:"claude-code", lane:"postgres", status:"passed", metrics:{ tokens:{totalTokens:1500,costUsd:0.15}, elapsedMs:90000, retrySignals:5 } },
  { agentId:"codex", lane:"mongo", status:"passed", metrics:{ tokens:{totalTokens:2000,costUsd:0.02}, elapsedMs:120000, retrySignals:3 } },
  { agentId:"codex", lane:"postgres", status:"passed", metrics:{ tokens:{totalTokens:2600,costUsd:0.026}, elapsedMs:160000, retrySignals:7 } }
];
const v = computeDatabaseVerdict(runs);
assert(v.perAgent.length === 2, "two agents");
assert(v.perAgent.every(a => a.mongoWins === true), "mongo fewer tokens for both agents");
assert(v.agreement.agentsAgreeMongoFewerTokens === true, "agents agree");
console.log("database verdict ok");
