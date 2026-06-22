import assert from "node:assert";
import { readFileSync } from "node:fs";
import { extractUsage } from "./agent-usage.mjs";

// Codex: real captured transcript carries turn.completed.usage
const codexText = readFileSync("instrumented-agent-runs/order-exception-codex-v1/mongo/raw-transcript/codex-events.jsonl", "utf8");
const codex = extractUsage("codex", codexText);
assert(codex.inputTokens === 297998, `codex input tokens, got ${codex.inputTokens}`);
assert(codex.outputTokens === 8241, `codex output tokens, got ${codex.outputTokens}`);
assert(codex.source === "measured", "codex usage is measured");
assert(codex.costUsd > 0, "codex cost derived from tokens");

// Claude: result event carries usage + total_cost_usd
const claudeText = [
  JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 5 } } }),
  JSON.stringify({ type: "result", subtype: "success", total_cost_usd: 0.42, usage: { input_tokens: 1200, output_tokens: 800, cache_read_input_tokens: 16000 } })
].join("\n");
const claude = extractUsage("claude-code", claudeText);
assert(claude.outputTokens === 800, `claude output tokens, got ${claude.outputTokens}`);
assert(claude.costUsd === 0.42, "claude cost is the CLI-reported total");
assert(claude.source === "measured", "claude usage is measured");

// Fallback: empty transcript -> estimated, never throws
const fb = extractUsage("claude-code", "");
assert(fb.source === "estimated", "empty transcript falls back to estimated");
console.log("agent-usage extractor ok");
