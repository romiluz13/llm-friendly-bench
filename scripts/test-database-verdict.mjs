import assert from "node:assert";
import { computeDatabaseVerdict } from "./benchmark-score.mjs";
const runs = [
  { agentId:"claude-code", lane:"mongo", status:"passed", metrics:{ tokens:{tokensRead:1000,totalTokens:900,costUsd:0.10}, elapsedMs:60000, retrySignals:2 } },
  { agentId:"claude-code", lane:"postgres", status:"passed", metrics:{ tokens:{tokensRead:1500,totalTokens:1300,costUsd:0.15}, elapsedMs:90000, retrySignals:5 } },
  { agentId:"codex", lane:"mongo", status:"passed", metrics:{ tokens:{tokensRead:2000,totalTokens:1800,costUsd:0.02}, elapsedMs:120000, retrySignals:3 } },
  { agentId:"codex", lane:"postgres", status:"passed", metrics:{ tokens:{tokensRead:2600,totalTokens:2400,costUsd:0.026}, elapsedMs:160000, retrySignals:7 } }
];
const v = computeDatabaseVerdict(runs);
assert(v.perAgent.length === 2, "two agents");
assert(v.perAgent.every(a => a.mongoWins === true), "mongo fewer tokensRead for both agents");
assert(v.agreement.agentsAgreeMongoFewerTokens === true, "agents agree on tokensRead");
// Verify medianTokensRead is used (not totalTokens)
const ccAgent = v.perAgent.find(a => a.agentId === "claude-code");
assert(ccAgent.mongo.medianTokensRead === 1000, `claude-code mongo medianTokensRead should be 1000, got ${ccAgent.mongo.medianTokensRead}`);
assert(ccAgent.postgres.medianTokensRead === 1500, `claude-code postgres medianTokensRead should be 1500, got ${ccAgent.postgres.medianTokensRead}`);
console.log("database verdict ok");
