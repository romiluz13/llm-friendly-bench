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
// tokensRead must equal inputTokens ONLY (cached is already a sub-count inside input_tokens)
assert(codex.tokensRead === codex.inputTokens, `codex tokensRead must be inputTokens only (${codex.inputTokens}), got ${codex.tokensRead}`);

// Codex no-double-count: cached_input_tokens is a sub-count inside input_tokens — must NOT add it again
{
  const t = JSON.stringify({ type: "turn.completed", usage: { input_tokens: 1000, cached_input_tokens: 600, output_tokens: 50 } });
  const u = extractUsage("codex", t);
  assert(u.tokensRead === 1000, `codex no-double-count: tokensRead must be 1000 (not 1600), got ${u.tokensRead}`);
  assert(u.inputTokens === 1000, `codex inputTokens, got ${u.inputTokens}`);
  assert(u.cachedInputTokens === 600, `codex cachedInputTokens, got ${u.cachedInputTokens}`);
  assert(u.outputTokens === 50, `codex outputTokens, got ${u.outputTokens}`);
  assert(u.source === "measured", "codex no-double-count: source=measured");
}

// Claude per-turn sum + cache_creation + dedup by message id
{
  // Two distinct message ids, plus a duplicate of id "a" (last-wins dedup)
  const lines = [
    JSON.stringify({ type: "assistant", message: { id: "a", usage: { input_tokens: 2, cache_read_input_tokens: 100, cache_creation_input_tokens: 50, output_tokens: 5 } } }),
    JSON.stringify({ type: "assistant", message: { id: "b", usage: { input_tokens: 2, cache_read_input_tokens: 200, cache_creation_input_tokens: 30, output_tokens: 8 } } }),
    // duplicate id "a" — should replace the first (last-wins), same values here so sum unchanged
    JSON.stringify({ type: "assistant", message: { id: "a", usage: { input_tokens: 2, cache_read_input_tokens: 100, cache_creation_input_tokens: 50, output_tokens: 5 } } }),
    JSON.stringify({ type: "result", subtype: "success", total_cost_usd: 1.23, usage: { input_tokens: 5, output_tokens: 3, cache_read_input_tokens: 27483, cache_creation_input_tokens: 1447 } })
  ];
  const t = lines.join("\n");
  const u = extractUsage("claude-code", t);
  // per-turn dedup: id "a" = {input:2, read:100, creation:50, out:5}, id "b" = {input:2, read:200, creation:30, out:8}
  // tokensRead = (2+100+50) + (2+200+30) = 152 + 232 = 384
  assert(u.tokensRead === 384, `claude per-turn sum: tokensRead must be 384, got ${u.tokensRead}`);
  assert(u.costUsd === 1.23, `claude cost from result event: must be 1.23, got ${u.costUsd}`);
  assert(u.source === "measured", "claude per-turn: source=measured");
  // cachedInputTokens = cacheRead + cacheCreation across per-turn deduped msgs = (100+50)+(200+30) = 380
  assert(u.cachedInputTokens === 380, `claude cachedInputTokens must be 380, got ${u.cachedInputTokens}`);
}

// Claude: result event carries usage + total_cost_usd (legacy test — updated to match new per-turn logic)
const claudeText = [
  JSON.stringify({ type: "assistant", message: { id: "msg1", usage: { input_tokens: 1200, output_tokens: 800, cache_read_input_tokens: 16000, cache_creation_input_tokens: 0 } } }),
  JSON.stringify({ type: "result", subtype: "success", total_cost_usd: 0.42, usage: { input_tokens: 1200, output_tokens: 800, cache_read_input_tokens: 16000 } })
].join("\n");
const claude = extractUsage("claude-code", claudeText);
assert(claude.outputTokens === 800, `claude output tokens, got ${claude.outputTokens}`);
assert(claude.costUsd === 0.42, "claude cost is the CLI-reported total");
assert(claude.source === "measured", "claude usage is measured");
// tokensRead = per-turn sum: input(1200) + cache_read(16000) + cache_creation(0) = 17200
assert(claude.tokensRead === 17200, `claude tokensRead should be 1200+16000=17200, got ${claude.tokensRead}`);

// Fallback: empty transcript -> estimated, never throws
const fb = extractUsage("claude-code", "");
assert(fb.source === "estimated", "empty transcript falls back to estimated");
console.log("agent-usage extractor ok");
